import { existsSync, statSync } from "node:fs";

import { resolveFromImporter } from "../lib/repo-path.ts";

const DIR_PREFIX = "dir:";

/** 返回错误信息；合法则 null。目录必须存在（web dist 用 git 占位 `.gitignore` / `.gitkeep`）。 */
export function checkDirImport(importerFile: string, spec: string): string | null {
  if (!spec.startsWith(DIR_PREFIX)) return null;
  const raw = spec.slice(DIR_PREFIX.length);
  if (!raw) return "`dir:` 缺少目录路径";
  const abs = resolveFromImporter(importerFile, raw);
  if (existsSync(abs)) {
    try {
      if (!statSync(abs).isDirectory()) {
        return `\`dir:${raw}\` 解析到的路径不是目录: ${abs}`;
      }
    } catch {
      return `\`dir:${raw}\` 无法 stat: ${abs}`;
    }
    return null;
  }
  return `\`dir:${raw}\` 目录不存在: ${abs}`;
}
