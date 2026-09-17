import type { RuntimeConfig } from "./schemas/runtime-config.ts";
import { PATHS } from "./paths.ts";

/** Whether jieba Chinese tokenization is enabled */
export function isCjkJiebaEnabled(cfg: RuntimeConfig): boolean {
  return cfg.cjk?.enabled === true;
}

/** jieba user dictionary path */
export function cjkJiebaDictPath(cfg: RuntimeConfig): string {
  const raw = cfg.cjk?.dict_path?.trim();
  if (raw) return raw;
  return PATHS.cjkUserDict;
}

export type CjkConfigSnapshot = {
  enabled: boolean;
  dict_path: string | null;
};

export function getCjkConfigSnapshot(cfg: RuntimeConfig): CjkConfigSnapshot {
  const enabled = isCjkJiebaEnabled(cfg);
  return {
    enabled,
    dict_path: enabled ? cjkJiebaDictPath(cfg) : null,
  };
}
