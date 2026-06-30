import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");

const SINGLE_PKG_LAYERS = ["kernel", "core", "runtime"] as const;
const PLATFORM_TEST_SUBDIRS = ["src", "connectors", "config", "bootstrap", "logging"] as const;

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

function pkgSrcHasTests(srcPath: string): boolean {
  if (!existsSync(srcPath)) return false;
  return srcDirHasTests(srcPath);
}

function pushIfHasTests(roots: string[], absPath: string): void {
  if (pkgSrcHasTests(absPath)) {
    roots.push(relative(repoRoot, absPath));
  }
}

function discoverSinglePkgLayerRoots(): string[] {
  const roots: string[] = [];
  for (const layer of SINGLE_PKG_LAYERS) {
    pushIfHasTests(roots, join(repoRoot, layer, "src"));
  }
  return roots;
}

function discoverCapabilitiesRoots(): string[] {
  const roots: string[] = [];
  const layerPath = join(repoRoot, "capabilities");
  if (!existsSync(layerPath)) return roots;

  for (const entry of readdirSync(layerPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    pushIfHasTests(roots, join(layerPath, entry.name, "src"));
  }
  return roots;
}

function discoverPlatformRoots(): string[] {
  const roots: string[] = [];
  const platformPath = join(repoRoot, "platform");
  if (!existsSync(platformPath)) return roots;

  for (const sub of PLATFORM_TEST_SUBDIRS) {
    pushIfHasTests(roots, join(platformPath, sub));
  }
  return roots;
}

/** Unit test roots: each package src + cli/src */
export function discoverUnitTestRoots(): string[] {
  const roots = [
    ...discoverSinglePkgLayerRoots(),
    ...discoverCapabilitiesRoots(),
    ...discoverPlatformRoots(),
  ];
  pushIfHasTests(roots, join(repoRoot, "app/cli/src"));
  return roots.toSorted();
}

/** Coverage shards: unit + tests/integration */
export function discoverTestRoots(): string[] {
  const roots = discoverUnitTestRoots();
  pushIfHasTests(roots, join(repoRoot, "tests/integration"));
  return roots.toSorted();
}

export function getRepoRoot(): string {
  return repoRoot;
}
