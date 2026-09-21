import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function srcDirHasTests(dir: string): boolean {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (srcDirHasTests(full)) return true;
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".test.ts") || entry.name.endsWith(".spec.ts"))
    ) {
      return true;
    }
  }
  return false;
}

function pushIfHasTests(roots: string[], absPath: string): void {
  if (!existsSync(absPath)) return;
  if (srcDirHasTests(absPath)) {
    roots.push(relative(repoRoot, absPath));
  }
}

/** Unit test roots: 所有含 colocated `*.test.ts` 的 `packages/*` 包（分包后不写死包名） */
export function discoverUnitTestRoots(): string[] {
  const roots: string[] = [];
  const packagesDir = join(repoRoot, "packages");
  if (!existsSync(packagesDir)) return roots;
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    pushIfHasTests(roots, join(packagesDir, entry.name));
  }
  return roots.toSorted();
}

/** Coverage shards: unit packages + `tests/integration` */
export function discoverTestRoots(): string[] {
  const roots = discoverUnitTestRoots();
  pushIfHasTests(roots, join(repoRoot, "tests/integration"));
  return roots.toSorted();
}

export function getRepoRoot(): string {
  return repoRoot;
}
