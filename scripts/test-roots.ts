import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");

const layerNames = ["kernel", "engine", "life", "service", "capabilities", "connectors"] as const;

function pkgSrcHasTests(srcPath: string): boolean {
  if (!existsSync(srcPath)) return false;
  function walk(dir: string): boolean {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (walk(full)) return true;
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(".test.ts") || entry.name.endsWith(".spec.ts"))
      ) {
        return true;
      }
    }
    return false;
  }
  return walk(srcPath);
}

function discoverLayerPkgSrcRoots(): string[] {
  const roots: string[] = [];

  for (const layer of layerNames) {
    const layerPath = join(repoRoot, layer);
    if (!existsSync(layerPath)) continue;
    for (const entry of readdirSync(layerPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const srcPath = join(layerPath, entry.name, "src");
      if (pkgSrcHasTests(srcPath)) {
        roots.push(relative(repoRoot, srcPath));
      }
    }
  }

  return roots;
}

/** Unit test roots: each package src + cli/src */
export function discoverUnitTestRoots(): string[] {
  const roots = discoverLayerPkgSrcRoots();
  const cliSrc = join(repoRoot, "cli/src");
  if (existsSync(cliSrc) && pkgSrcHasTests(cliSrc)) {
    roots.push("cli/src");
  }
  return roots.toSorted();
}

/** Coverage shards: unit + tests/integration */
export function discoverTestRoots(): string[] {
  const roots = discoverUnitTestRoots();
  const integration = join(repoRoot, "tests/integration");
  if (existsSync(integration) && pkgSrcHasTests(integration)) {
    roots.push("tests/integration");
  }
  return roots.toSorted();
}

export function getRepoRoot(): string {
  return repoRoot;
}
