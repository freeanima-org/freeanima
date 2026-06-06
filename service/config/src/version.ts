import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { getRepoRoot } from "./repo-root.ts";

/** 读取 monorepo 根 package.json 的 version（User-Agent 等） */
export function readAppVersion(repoRoot?: string): string {
  const root = repoRoot ?? getRepoRoot();
  const path = join(root, "package.json");
  const pkg = JSON.parse(readFileSync(path, "utf8")) as { version?: string };
  if (!pkg.version) {
    throw new Error(`根 package.json 缺少 version 字段: ${path}`);
  }
  return pkg.version;
}

/** @deprecated 使用 readAppVersion */
export const readRootVersion = readAppVersion;

/** 写入 monorepo 根 package.json 的 version */
export function writeRootVersion(version: string, repoRoot?: string): void {
  const root = repoRoot ?? getRepoRoot();
  const path = join(root, "package.json");
  const pkg = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  pkg.version = version;
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}
