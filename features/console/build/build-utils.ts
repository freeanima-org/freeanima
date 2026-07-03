import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const ADMIN_APP_REL = join("features", "console", "ui", "admin");
const ADMIN_PUBLISH_APP_REL = join("admin-frontend", "app");

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

/** 计算 Admin 前端源码 hash（含根 bunfig.toml） */
export function computeAdminSourceHash(appDir: string, repoRoot = REPO_ROOT): string {
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

/** Published @freeanima/cli layout, or monorepo `features/console/ui/admin`. */
export function resolveAdminAppDir(repoRoot = REPO_ROOT): string {
  const publish = join(repoRoot, ADMIN_PUBLISH_APP_REL);
  if (existsSync(publish)) return publish;
  const monorepo = join(repoRoot, ADMIN_APP_REL);
  if (existsSync(monorepo)) return monorepo;
  return publish;
}

export function isAdminIndexHtmlValid(htmlPath: string): boolean {
  if (!existsSync(htmlPath)) return false;
  try {
    const html = readFileSync(htmlPath, "utf-8");
    return html.includes("root");
  } catch {
    return false;
  }
}

export const ADMIN_PUBLIC_PATH = "/admin/";
