import { readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

export interface GitignoreRule {
  pattern: string;
  negated: boolean;
  dirOnly: boolean;
}

/** Parse a single .gitignore file */
export function parseGitignore(content: string): GitignoreRule[] {
  const rules: GitignoreRule[] = [];
  for (const raw of content.split("\n")) {
    let line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    let negated = false;
    if (line.startsWith("!")) {
      negated = true;
      line = line.slice(1);
    }
    const dirOnly = line.endsWith("/");
    if (dirOnly) line = line.slice(0, -1);
    if (!line) continue;
    rules.push({ pattern: line, negated, dirOnly });
  }
  return rules;
}

/** gitignore glob → RegExp (supports *, ?, **) */
function globToRegex(pattern: string, rootAnchored: boolean): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\0")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .replace(/\0/g, ".*");
  if (rootAnchored) {
    return new RegExp(`^${escaped}(/.*)?$`);
  }
  if (!pattern.includes("/")) {
    return new RegExp(`(^|/)${escaped}$`);
  }
  return new RegExp(`(^|/)${escaped}(/.*)?$`);
}

function ruleMatches(relPath: string, isDir: boolean, rule: GitignoreRule): boolean {
  if (rule.dirOnly && !isDir) return false;

  let pat = rule.pattern;
  const rootAnchored = pat.startsWith("/");
  if (rootAnchored) pat = pat.slice(1);

  if (rootAnchored) {
    return globToRegex(pat, true).test(relPath);
  }

  if (pat.includes("/")) {
    return globToRegex(pat, false).test(relPath);
  }

  const base = relPath.split("/").pop() ?? relPath;
  return globToRegex(pat, false).test(base);
}

/** Whether path is ignored per gitignore rule stack */
export function isIgnored(relPath: string, isDir: boolean, ruleSets: GitignoreRule[][]): boolean {
  let ignored = false;
  for (const rules of ruleSets) {
    for (const rule of rules) {
      if (ruleMatches(relPath, isDir, rule)) {
        ignored = !rule.negated;
      }
    }
  }
  return ignored;
}

/** Collect .gitignore rules from root to dir path (including root) */
export function loadGitignoreStack(workspaceRoot: string, absDir: string): GitignoreRule[][] {
  const stack: GitignoreRule[][] = [];
  const rel = relative(workspaceRoot, absDir);
  const parts = rel ? rel.split("/") : [];
  let current = workspaceRoot;
  const rootGi = join(workspaceRoot, ".gitignore");
  if (existsSync(rootGi)) {
    try {
      stack.push(parseGitignore(readFileSync(rootGi, "utf-8")));
    } catch {
      /* ignore */
    }
  }
  for (const part of parts) {
    current = join(current, part);
    const gi = join(current, ".gitignore");
    if (existsSync(gi)) {
      try {
        stack.push(parseGitignore(readFileSync(gi, "utf-8")));
      } catch {
        /* ignore */
      }
    }
  }
  return stack;
}

/** Directory names always skipped by default */
export const DEFAULT_SKIP_DIRS = new Set(["node_modules", ".git"]);
