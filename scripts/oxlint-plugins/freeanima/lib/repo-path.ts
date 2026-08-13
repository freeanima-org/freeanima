import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** 本文件位于 `scripts/oxlint-plugins/freeanima/lib/` → 仓根再上四级。 */
const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, "../../../..");

/** 绝对路径 → 相对仓根的 POSIX 路径。 */
export function relToRepo(filename: string): string {
  return relative(REPO_ROOT, filename).split(sep).join("/");
}

export function resolveFromImporter(importerFile: string, specPath: string): string {
  if (specPath.startsWith("/")) return resolve(specPath);
  return resolve(dirname(importerFile), specPath);
}

export function underScanRoots(rel: string, roots: readonly string[]): boolean {
  return roots.some((r) => rel === r || rel.startsWith(`${r}/`));
}

export function joinRepo(...parts: string[]): string {
  return join(REPO_ROOT, ...parts);
}
