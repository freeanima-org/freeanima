import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let cachedRepoRoot: string | null = null;

const ROOT_PACKAGE_NAME = "freeanima";
const CLI_PACKAGE_NAME = "@freeanima/cli";

function packageNameAt(dir: string): string | null {
  const path = join(dir, "package.json");
  if (!existsSync(path)) return null;
  try {
    const pkg = JSON.parse(readFileSync(path, "utf8")) as { name?: string };
    return typeof pkg.name === "string" ? pkg.name : null;
  } catch {
    return null;
  }
}

function isRepoRoot(dir: string): boolean {
  const name = packageNameAt(dir);
  return name === ROOT_PACKAGE_NAME || name === CLI_PACKAGE_NAME;
}

/** Walk upward from startDir for the freeanima monorepo root (package name `freeanima`). */
export function resolveMonorepoRoot(startDir?: string): string | null {
  const fromEnv = process.env.FREEANIMA_REPO_ROOT?.trim();
  if (fromEnv && packageNameAt(fromEnv) === ROOT_PACKAGE_NAME) return fromEnv;

  if (!startDir) return null;
  let dir = startDir;
  for (let i = 0; i < 16; i++) {
    if (packageNameAt(dir) === ROOT_PACKAGE_NAME) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** Monorepo or @freeanima/cli published package root */
export function getRepoRoot(): string {
  if (cachedRepoRoot) return cachedRepoRoot;

  const fromEnv = process.env.FREEANIMA_REPO_ROOT?.trim();
  if (fromEnv && isRepoRoot(fromEnv)) {
    cachedRepoRoot = fromEnv;
    return cachedRepoRoot;
  }

  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 16; i++) {
    if (isRepoRoot(dir)) {
      cachedRepoRoot = dir;
      return cachedRepoRoot;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  cachedRepoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
  return cachedRepoRoot;
}
