#!/usr/bin/env bun
/**
 * Layer boundary dependency check: scan @freeanima/* imports against architecture rules.
 * Tests and test-helpers directories are exempt.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");

type Violation = { file: string; line: number; pkg: string; reason: string };
type EngineTier = "foundation" | "mechanism" | "orchestration";

const IMPORT_RE = /from\s+["']@freeanima\/([^"']+)["']/g;

/** First segment of import path is the workspace package name (e.g. service/schemas/display → service) */
function workspacePkgName(importPath: string): string {
  return importPath.split("/")[0] ?? importPath;
}

const ENGINE_PKG_TIER: Record<string, EngineTier> = {
  "engine-config": "foundation",
  "engine-db": "foundation",
  "engine-repos": "foundation",
  "engine-util": "foundation",
  "engine-tokenizer": "foundation",
  "engine-provider-llm": "foundation",
  "engine-tool": "mechanism",
  "engine-skill": "mechanism",
  "engine-prompt": "mechanism",
  "engine-llm": "mechanism",
  "engine-compress": "mechanism",
  "engine-hooks": "mechanism",
  "engine-session-port": "mechanism",
  "engine-session": "orchestration",
  "engine-turn": "orchestration",
  "engine-conversation": "orchestration",
  "engine-loop": "orchestration",
  engine: "orchestration",
};

const LIFE_ENGINE_ALLOW = new Set([
  "engine-tool",
  "engine-repos",
  "engine-util",
  "engine-db",
  "engine-config",
]);

const CAPABILITIES_ENGINE_DENY = new Set([
  "engine-session",
  "engine-turn",
  "engine-conversation",
  "engine-loop",
  "engine",
]);

function engineSubTier(relPath: string): EngineTier | null {
  const parts = relPath.split("/");
  if (parts[0] !== "engine") return null;
  const sub = parts[1];
  if (sub === "foundation") return "foundation";
  if (sub === "mechanism") return "mechanism";
  if (sub === "orchestration") return "orchestration";
  return null;
}

function enginePkgTier(pkg: string): EngineTier | null {
  return ENGINE_PKG_TIER[workspacePkgName(pkg)] ?? null;
}

function tierRank(tier: EngineTier): number {
  switch (tier) {
    case "foundation":
      return 0;
    case "mechanism":
      return 1;
    case "orchestration":
      return 2;
  }
}

function sourceEnginePkg(relPath: string): string | null {
  const parts = relPath.split("/");
  if (parts[0] !== "engine" || parts.length < 3) return null;
  const dir = parts[2];
  if (!dir) return null;
  if (dir === "engine") return "engine";
  return `engine-${dir}`;
}

function isExempt(relPath: string): boolean {
  if (relPath.includes("/tests/")) return true;
  if (relPath.includes("/test-helpers/")) return true;
  if (/\.(test|spec)\.ts$/.test(relPath)) return true;
  if (relPath.startsWith("tests/")) return true;
  if (relPath.startsWith("cli/")) return true;
  return false;
}

function layerOf(relPath: string): string | null {
  const top = relPath.split("/")[0];
  if (
    top === "kernel" ||
    top === "engine" ||
    top === "life" ||
    top === "capabilities" ||
    top === "connectors" ||
    top === "service"
  ) {
    return top;
  }
  return null;
}

function isAllowed(layer: string, pkg: string, _relPath: string): boolean {
  const root = workspacePkgName(pkg);
  switch (layer) {
    case "kernel":
      return root.startsWith("kernel-") || root === "kernel";
    case "engine":
      if (root.startsWith("kernel-") || root === "kernel") return true;
      if (root.startsWith("engine-") || root === "engine") return true;
      if (root.startsWith("capabilities-provider")) return true;
      if (root === "connectors-db-pg") return false;
      return false;
    case "life":
      if (root.startsWith("kernel-") || root === "kernel") return true;
      if (root.startsWith("life-") || root === "life") return true;
      if (root.startsWith("engine-") || root === "engine") {
        return LIFE_ENGINE_ALLOW.has(root);
      }
      if (root === "connectors-db-pg") return false;
      if (root === "service-config" || root === "service-logging") return true;
      return false;
    case "capabilities":
      if (root.startsWith("kernel-") || root === "kernel") return true;
      if (root.startsWith("engine-") || root === "engine") {
        return !CAPABILITIES_ENGINE_DENY.has(root);
      }
      if (root.startsWith("capabilities-") || root === "capabilities") return true;
      if (root.startsWith("life-memory")) return true;
      if (root === "service-config" || root === "service-logging") return true;
      return false;
    case "connectors":
      if (root === "service") return false;
      return true;
    case "service":
      return true;
    default:
      return true;
  }
}

function engineTierViolation(
  relPath: string,
  pkg: string,
): { ok: true } | { ok: false; reason: string } {
  const sourceTier = engineSubTier(relPath);
  const importRoot = workspacePkgName(pkg);
  const importTier = enginePkgTier(pkg);
  if (!sourceTier || !importTier) return { ok: true };

  const sourcePkg = sourceEnginePkg(relPath);
  if (sourceTier === "orchestration" && importTier === "orchestration") {
    if (sourcePkg === "engine-loop" && importRoot === "engine-conversation") {
      return {
        ok: false,
        reason: "engine orchestration: engine-loop must not depend on engine-conversation",
      };
    }
    const orchestrationAllows: Record<string, ReadonlySet<string>> = {
      "engine-turn": new Set(["engine-session"]),
      "engine-conversation": new Set(["engine-session", "engine-turn"]),
      engine: new Set(["engine-session", "engine-turn", "engine-conversation", "engine-loop"]),
    };
    if (sourcePkg !== importRoot && sourcePkg !== "engine") {
      const allowed = orchestrationAllows[sourcePkg ?? ""];
      if (!allowed?.has(importRoot)) {
        return {
          ok: false,
          reason: `engine orchestration: ${sourcePkg} must not depend on ${importRoot}`,
        };
      }
    }
  }

  if (tierRank(importTier) > tierRank(sourceTier)) {
    return {
      ok: false,
      reason: `engine ${sourceTier} must not depend on engine ${importTier} (@freeanima/${importRoot})`,
    };
  }

  return { ok: true };
}

function reasonFor(layer: string, pkg: string): string {
  const root = workspacePkgName(pkg);
  return `layer ${layer} must not depend on @freeanima/${root}`;
}

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist" || name === "coverage") continue;
      walk(abs, out);
    } else if (name.endsWith(".ts") || name.endsWith(".tsx")) {
      out.push(abs);
    }
  }
}

function scan(): Violation[] {
  const violations: Violation[] = [];
  const files: string[] = [];
  for (const dir of ["kernel", "engine", "life", "capabilities", "connectors", "service"]) {
    const abs = join(ROOT, dir);
    try {
      walk(abs, files);
    } catch {
      /* missing dir */
    }
  }

  for (const abs of files) {
    const rel = relative(ROOT, abs);
    if (isExempt(rel)) continue;
    const layer = layerOf(rel);
    if (!layer) continue;

    const content = readFileSync(abs, "utf-8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      IMPORT_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = IMPORT_RE.exec(line)) !== null) {
        const pkg = m[1] ?? "";
        if (!isAllowed(layer, pkg, rel)) {
          violations.push({
            file: rel,
            line: i + 1,
            pkg,
            reason: reasonFor(layer, pkg),
          });
          continue;
        }
        if (layer === "engine") {
          const tierCheck = engineTierViolation(rel, pkg);
          if (!tierCheck.ok) {
            violations.push({
              file: rel,
              line: i + 1,
              pkg,
              reason: tierCheck.reason,
            });
          }
        }
      }
    }
  }
  return violations;
}

const violations = scan();
if (violations.length === 0) {
  console.log("dep-check: OK");
  process.exit(0);
}

console.error(`dep-check: ${violations.length} violation(s)`);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line} — ${v.reason}`);
}
process.exit(1);
