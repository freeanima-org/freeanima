import { getRepoRoot } from "@freeanima/habitat/core/config/repo-root";
import { asRecord } from "@freeanima/shared/util";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MONOREPO_PACKAGE_NAME = "freeanima";
const CLI_PACKAGE_NAME = "@freeanima/cli";

export type InstallContext = {
  monorepoRoot: string | null;
  cliRoot: string;
};

function packageNameAt(dir: string): string | null {
  const path = join(dir, "package.json");
  if (!existsSync(path)) return null;
  try {
    const pkg = asRecord(JSON.parse(readFileSync(path, "utf8")));
    return typeof pkg?.name === "string" ? pkg.name : null;
  } catch {
    return null;
  }
}

function findPackageRoot(startDir: string, packageName: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 16; i++) {
    if (packageNameAt(dir) === packageName) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** Monorepo root (freeanima) and CLI package root. */
export function getInstallContext(): InstallContext {
  const start = dirname(fileURLToPath(import.meta.url));
  const monorepoRoot = findPackageRoot(start, MONOREPO_PACKAGE_NAME);
  const cliRoot = findPackageRoot(start, CLI_PACKAGE_NAME) ?? getRepoRoot();
  return { monorepoRoot, cliRoot };
}
