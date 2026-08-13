import { readFileSync } from "node:fs";

import { getActiveRuntimeConfig } from "@freeanima/host/core/config";
import { isCjkJiebaEnabled, cjkJiebaDictPath } from "@freeanima/host/core/config/cjk-config";
import type { Jieba } from "@node-rs/jieba";
/** Embed default dict for Bun `--compile` (do not use `@node-rs/jieba/dict` — it readFileSync(__dirname)). */
import jiebaDictPath from "@node-rs/jieba/dict.txt" with { type: "file" };

import { logPgComponent } from "../log.ts";

const CJK_RUN_RE = /[\u4e00-\u9fff\u3400-\u4dbf]+/g;
const log = logPgComponent("fts");

let jiebaInstance: Jieba | null = null;
let jiebaLoadFailed = false;

/** Shared jieba singleton for FTS segment / content-word tagging. */
export async function getJiebaForFts(): Promise<Jieba | null> {
  if (!isCjkJiebaEnabled(getActiveRuntimeConfig().data)) return null;
  if (jiebaLoadFailed) return null;
  if (jiebaInstance) return jiebaInstance;
  try {
    const { Jieba } = await import("@node-rs/jieba");
    const jieba = Jieba.withDict(readFileSync(jiebaDictPath));
    const dictPath = cjkJiebaDictPath(getActiveRuntimeConfig().data);
    try {
      jieba.loadDict(readFileSync(dictPath));
    } catch {
      /* user dictionary optional */
    }
    jiebaInstance = jieba;
    return jieba;
  } catch (err) {
    jiebaLoadFailed = true;
    log.warn("jieba load failed", { error: String(err) });
    return null;
  }
}

/** Whether jieba singleton has been loaded in this process. */
export function isJiebaLoaded(): boolean {
  return jiebaInstance != null;
}

/** Reset jieba singleton (test teardown) */
export function resetJiebaForTest(): void {
  jiebaInstance = null;
  jiebaLoadFailed = false;
}

/** CJK segments via jieba + non-CJK as-is, output FTS input string */
export async function segmentForFts(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const jieba = await getJiebaForFts();
  if (!jieba) return trimmed;

  const parts: string[] = [];
  let last = 0;
  for (const match of trimmed.matchAll(CJK_RUN_RE)) {
    const index = match.index ?? 0;
    if (index > last) {
      parts.push(trimmed.slice(last, index));
    }
    parts.push(jieba.cut(match[0], false).join(" "));
    last = index + match[0].length;
  }
  if (last < trimmed.length) {
    parts.push(trimmed.slice(last));
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}
