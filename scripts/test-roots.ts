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

/** Unit test roots: packages/* colocated `*.test.ts` */
export function discoverUnitTestRoots(): string[] {
  const roots: string[] = [];
  for (const pkg of ["shared", "habitat", "frontend"] as const) {
    pushIfHasTests(roots, join(repoRoot, "packages", pkg));
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
