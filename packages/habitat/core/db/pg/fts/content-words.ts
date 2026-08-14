import type { Jieba } from "@node-rs/jieba";

import { getJiebaForFts } from "./segment.ts";

const CJK_RUN_RE = /[\u4e00-\u9fff\u3400-\u4dbf]+/g;

/**
 * Function / discourse words that must never enter FTS/trgm queries.
 * Includes verbs jieba often tags as `v` (是/有/…) so POS allowlist alone is insufficient.
 */
export const FTS_QUERY_STOPWORDS = new Set([
  // pronouns / particles / question words
  "的",
  "了",
  "吗",
  "呢",
  "啊",
  "吧",
  "呀",
  "嘛",
  "哈",
  "你",
  "我",
  "他",
  "她",
  "它",
  "您",
  "们",
  "这",
  "那",
  "哪",
  "谁",
  "什么",
  "怎么",
  "怎样",
  "为何",
  "为什么",
  "多少",
  "几",
  // copula / auxiliaries / light verbs
  "是",
  "有",
  "在",
  "会",
  "能",
  "可以",
  "可",
  "要",
  "让",
  "把",
  "被",
  "给",
  "对",
  "和",
  "与",
  "或",
  "及",
  "并",
  "而",
  "就",
  "都",
  "也",
  "还",
  "很",
  "真",
  "真的",
  "非常",
  "比较",
  "更",
  "最",
  "不",
  "没",
  "没有",
  "请",
  "一下",
  // English
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "am",
  "i",
  "you",
  "he",
  "she",
  "it",
  "we",
  "they",
  "me",
  "my",
  "your",
  "his",
  "her",
  "its",
  "our",
  "their",
  "what",
  "which",
  "who",
  "whom",
  "how",
  "why",
  "when",
  "where",
  "do",
  "does",
  "did",
  "can",
  "could",
  "would",
  "should",
  "will",
  "shall",
  "may",
  "might",
  "must",
  "of",
  "to",
  "for",
  "in",
  "on",
  "at",
  "by",
  "with",
  "from",
  "as",
  "and",
  "or",
  "not",
  "no",
  "yes",
  "this",
  "that",
  "these",
  "those",
]);

/** Keep nouns / verbs / English; reject function tags (r/uj/c/…). */
export function isContentPosTag(tag: string): boolean {
  const t = tag.trim().toLowerCase();
  if (!t) return false;
  if (t === "eng" || t === "x") return true;
  return t.startsWith("n") || t.startsWith("v");
}

export function isFtsQueryStopword(word: string): boolean {
  const w = word.trim().toLowerCase();
  if (!w) return true;
  return FTS_QUERY_STOPWORDS.has(w);
}

function cleanToken(raw: string): string {
  return raw.replace(/[^\w\u4e00-\u9fff\u3400-\u4dbf-]/g, "").trim();
}

function keepWord(word: string, tag?: string): boolean {
  const cleaned = cleanToken(word);
  if (!cleaned) return false;
  if (isFtsQueryStopword(cleaned)) return false;
  if (tag != null && !isContentPosTag(tag)) return false;
  return true;
}

function pushNonCjkTokens(chunk: string, out: string[]): void {
  for (const tok of chunk.split(/\s+/)) {
    const cleaned = cleanToken(tok);
    if (!cleaned) continue;
    if (keepWord(cleaned)) out.push(cleaned);
  }
}

function tagCjkRun(jieba: Jieba, run: string): string[] {
  const out: string[] = [];
  for (const { word, tag } of jieba.tag(run, false)) {
    if (keepWord(word, tag)) out.push(cleanToken(word));
  }
  return out.filter(Boolean);
}

function cutCjkRunDenylistOnly(jieba: Jieba, run: string): string[] {
  return jieba
    .cut(run, false)
    .map(cleanToken)
    .filter((w) => w && keepWord(w));
}

export type ContentWordsResult = {
  /** Space-joined content words (or original when fell back). */
  query: string;
  words: string[];
  /** True when filtering emptied the query and we kept the original text. */
  fell_back: boolean;
};

/**
 * Extract noun/verb (and eng) content words for FTS/trgm queries.
 * Vector / embedding paths must keep the full natural-language sentence.
 */
export async function extractContentWords(text: string): Promise<ContentWordsResult> {
  const trimmed = text.trim();
  if (!trimmed) return { query: "", words: [], fell_back: false };

  const jieba = await getJiebaForFts();
  const words: string[] = [];

  if (!jieba) {
    // No jieba: denylist-only pass over whitespace tokens + raw CJK runs as wholes if short.
    pushNonCjkTokens(trimmed, words);
    if (words.length === 0) {
      return { query: trimmed, words: [trimmed], fell_back: true };
    }
    return { query: words.join(" "), words, fell_back: false };
  }

  let last = 0;
  for (const match of trimmed.matchAll(CJK_RUN_RE)) {
    const index = match.index ?? 0;
    if (index > last) {
      pushNonCjkTokens(trimmed.slice(last, index), words);
    }
    const run = match[0];
    const tagged = tagCjkRun(jieba, run);
    if (tagged.length > 0) {
      words.push(...tagged);
    } else {
      // POS wiped everything (e.g. only stopwords); try cut+denylist as softer pass.
      words.push(...cutCjkRunDenylistOnly(jieba, run));
    }
    last = index + run.length;
  }
  if (last < trimmed.length) {
    pushNonCjkTokens(trimmed.slice(last), words);
  }

  if (words.length === 0) {
    return { query: trimmed, words: [trimmed], fell_back: true };
  }
  return { query: words.join(" "), words, fell_back: false };
}
