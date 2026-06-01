import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const defaultRepoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

export function getRepoRoot(): string {
  return defaultRepoRoot;
}

function rootPackagePath(repoRoot: string = getRepoRoot()): string {
  return join(repoRoot, "package.json");
}

export function readRootVersion(repoRoot?: string): string {
  const root = repoRoot ?? getRepoRoot();
  const pkg = JSON.parse(readFileSync(rootPackagePath(root), "utf8")) as {
    version: string;
  };
  if (!pkg.version) {
    throw new Error("根 package.json 缺少 version 字段");
  }
  return pkg.version;
}

export function writeRootVersion(version: string, repoRoot?: string): void {
  const root = repoRoot ?? getRepoRoot();
  const path = rootPackagePath(root);
  const pkg = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  pkg.version = version;
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}
