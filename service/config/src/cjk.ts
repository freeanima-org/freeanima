import { existsSync } from "node:fs";

import { loadConfig } from "./config.ts";
import { PATHS } from "./paths.ts";

/** Whether CJK jieba tokenization is enabled (default false) */
export function isCjkJiebaEnabled(): boolean {
  return loadConfig().cjk?.enabled === true;
}

/** jieba user dictionary path */
export function cjkJiebaDictPath(): string {
  const raw = loadConfig().cjk?.dict_path?.trim();
  return raw || PATHS.cjkUserDict;
}

export type CjkConfigSnapshot = {
  enabled: boolean;
  dict_path: string;
  dict_exists: boolean;
};

/** For WebUI / status display */
export function getCjkConfigSnapshot(): CjkConfigSnapshot {
  const dict_path = cjkJiebaDictPath();
  return {
    enabled: isCjkJiebaEnabled(),
    dict_path,
    dict_exists: existsSync(dict_path),
  };
}
