import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let cachedRepoRoot: string | null = null;

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

/** monorepo 根目录 */
export function getRepoRoot(): string {
  if (cachedRepoRoot) return cachedRepoRoot;

  const fromEnv = process.env.FREEANIMA_REPO_ROOT?.trim();
  if (fromEnv && packageNameAt(fromEnv) === "freeanima") {
    cachedRepoRoot = fromEnv;
    return cachedRepoRoot;
  }

  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 16; i++) {
    if (packageNameAt(dir) === "freeanima") {
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
