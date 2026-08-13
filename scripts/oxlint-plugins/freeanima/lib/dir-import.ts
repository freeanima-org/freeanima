import { existsSync, statSync } from "node:fs";

import { resolveFromImporter } from "../lib/repo-path.ts";

const DIR_PREFIX = "dir:";

/** 运行时对缺失目录返回空 map；web dist 构建产物可缺。 */
export const ALLOW_MISSING_SUFFIXES = ["/app/web/dist", "/web/dist"] as const;

export function allowMissingDir(resolvedAbs: string): boolean {
  const norm = resolvedAbs.replaceAll("\\", "/");
  return ALLOW_MISSING_SUFFIXES.some((s) => norm.endsWith(s));
}

/** 返回错误信息；合法则 null。 */
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
  if (allowMissingDir(abs)) return null;
  return `\`dir:${raw}\` 目录不存在: ${abs}`;
}
