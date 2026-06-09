import { existsSync } from "node:fs";

import { loadConfig } from "./config.ts";
import { PATHS } from "./paths.ts";

/** 是否启用 CJK jieba 分词（默认 false） */
export function isCjkJiebaEnabled(): boolean {
  return loadConfig().cjk?.enabled === true;
}

/** jieba 用户词典路径 */
export function cjkJiebaDictPath(): string {
  const raw = loadConfig().cjk?.dict_path?.trim();
  return raw || PATHS.cjkUserDict;
}

export type CjkConfigSnapshot = {
  enabled: boolean;
  dict_path: string;
  dict_exists: boolean;
};

/** WebUI / 状态展示用 */
export function getCjkConfigSnapshot(): CjkConfigSnapshot {
  const dict_path = cjkJiebaDictPath();
  return {
    enabled: isCjkJiebaEnabled(),
    dict_path,
    dict_exists: existsSync(dict_path),
  };
}
