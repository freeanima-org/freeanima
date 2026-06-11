import type { AnimaConfig } from "@freeanima/engine-config";
import { homePath } from "./paths.ts";

/** Whether jieba Chinese tokenization is enabled */
export function isCjkJiebaEnabled(cfg: AnimaConfig): boolean {
  return cfg.cjk?.enabled === true;
}

/** jieba user dictionary path */
export function cjkJiebaDictPath(cfg: AnimaConfig): string {
  const raw = cfg.cjk?.dict_path?.trim();
  if (raw) return raw;
  return homePath("jieba_userdict.txt");
}

export type CjkConfigSnapshot = {
  enabled: boolean;
  dict_path: string | null;
};

export function getCjkConfigSnapshot(cfg: AnimaConfig): CjkConfigSnapshot {
  const enabled = isCjkJiebaEnabled(cfg);
  return {
    enabled,
    dict_path: enabled ? cjkJiebaDictPath(cfg) : null,
  };
}
