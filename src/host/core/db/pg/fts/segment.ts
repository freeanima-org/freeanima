import { readFileSync } from "node:fs";

import {
  getActiveRuntimeConfig,
  isCjkJiebaEnabled,
  cjkJiebaDictPath,
} from "@freeanima/host/core/config";
import type { Jieba } from "@node-rs/jieba";

const CJK_RUN_RE = /[\u4e00-\u9fff\u3400-\u4dbf]+/g;

let jiebaInstance: Jieba | null = null;
let jiebaLoadFailed = false;

async function getJieba(): Promise<Jieba | null> {
  if (!isCjkJiebaEnabled(getActiveRuntimeConfig().data)) return null;
  if (jiebaLoadFailed) return null;
  if (jiebaInstance) return jiebaInstance;
  try {
    const { Jieba } = await import("@node-rs/jieba");
    const { dict } = await import("@node-rs/jieba/dict");
    const jieba = Jieba.withDict(dict);
    const dictPath = cjkJiebaDictPath(getActiveRuntimeConfig().data);
    try {
      jieba.loadDict(readFileSync(dictPath));
    } catch {
      /* user dictionary optional */
    }
    jiebaInstance = jieba;
    return jieba;
  } catch {
    jiebaLoadFailed = true;
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

  const jieba = await getJieba();
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
