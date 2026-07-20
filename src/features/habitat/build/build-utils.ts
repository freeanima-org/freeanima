import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const HABITAT_APP_REL = join("src", "features", "habitat", "ui", "habitat");

function walkFiles(dir: string, files: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const ent of entries.toSorted((a, b) => a.name.localeCompare(b.name))) {
    const abs = join(dir, ent.name);
    if (ent.isDirectory()) {
      walkFiles(abs, files);
    } else if (ent.isFile()) {
      files.push(abs);
    }
  }
  return files;
}

function hashFileEntry(hash: ReturnType<typeof createHash>, root: string, absPath: string): void {
  const rel = relative(root, absPath);
  const stat = statSync(absPath);
  hash.update(rel);
  hash.update("\0");
  hash.update(String(stat.size));
  hash.update("\0");
  hash.update(String(stat.mtimeMs));
  hash.update("\0");
}

/** 计算 Habitat 前端源码 hash（含根 bunfig.toml） */
export function computeConsoleSourceHash(appDir: string, repoRoot = REPO_ROOT): string {
  const hash = createHash("sha256");
  const files = walkFiles(appDir).toSorted((a, b) => a.localeCompare(b));
  for (const abs of files) {
    hashFileEntry(hash, appDir, abs);
  }
  const bunfigPath = join(repoRoot, "bunfig.toml");
  if (existsSync(bunfigPath)) {
    hash.update("bunfig.toml");
    hash.update("\0");
    hashFileEntry(hash, repoRoot, bunfigPath);
  }
  return hash.digest("hex");
}

/** Monorepo Habitat UI 源码目录 */
export function resolveConsoleAppDir(repoRoot = REPO_ROOT): string {
  return join(repoRoot, HABITAT_APP_REL);
}

export function isConsoleIndexHtmlValid(htmlPath: string): boolean {
  if (!existsSync(htmlPath)) return false;
  try {
    const html = readFileSync(htmlPath, "utf-8");
    return html.includes("root");
  } catch {
    return false;
  }
}

export const HABITAT_PUBLIC_PATH = "/habitat/";
