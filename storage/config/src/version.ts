import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

/** Monorepo or @freeanima/cli published package root */
export function getRepoRoot(): string {
  const fromEnv = process.env.FREEANIMA_REPO_ROOT?.trim();
  if (fromEnv && isRepoRoot(fromEnv)) return fromEnv;

  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 16; i++) {
    if (isRepoRoot(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return join(dirname(fileURLToPath(import.meta.url)), "../../..");
}

/** Read monorepo root package.json version (User-Agent etc.) */
export function readAppVersion(repoRoot?: string): string {
  const root = repoRoot ?? getRepoRoot();
  const path = join(root, "package.json");
  const pkg = JSON.parse(readFileSync(path, "utf8")) as { version?: string };
  if (!pkg.version) {
    throw new Error(`root package.json missing version field: ${path}`);
  }
  return pkg.version;
}
