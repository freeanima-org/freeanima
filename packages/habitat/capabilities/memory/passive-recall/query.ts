import { stripUserTimePrefix } from "@freeanima/habitat/core/hooks/prompt";

export const PASSIVE_RECALL_QUERY_MAX = 320;

/** Strip runtime-only time tag before using user text as a recall query. */
export function stripTimePrefixFromUserContent(content: string): string {
  return stripUserTimePrefix(content);
}

/**
 * 对话正文 → FTS 查询：去掉会触发 validateFtsQueryInput 的无意语法。
 * 工具/UI 显式检索勿用本函数（用户写的 OR/"短语"应保留并校验）。
 */
export function sanitizeFreeTextForFtsQuery(raw: string): string {
  let q = raw.trim();
  if (!q) return q;

  let quoteCount = 0;
  for (const ch of q) {
    if (ch === '"') quoteCount += 1;
  }
  // 奇数引号无法成对；正文场景直接去掉引号，避免整次召回失败
  if (quoteCount % 2 !== 0) {
    q = q.replaceAll('"', "");
  }

  // 英文小写 or/and 会被当成非法布尔运算符；折叠为空格当普通分隔
  if (/\s(or|and)\s/i.test(q) && !/\s(OR|AND|NOT)\s/.test(q)) {
    q = q.replace(/\s+(?:or|and)\s+/gi, " ");
  }

  return q.trim().replace(/\s+/g, " ");
}

/**
 * Focus long user messages for retrieval: trailing text usually carries the current intent.
 * Full message is still sent to the LLM; only passive recall search uses this slice.
 */
export function focusPassiveRecallQuery(
  content: string,
  maxLen = PASSIVE_RECALL_QUERY_MAX,
): string {
  const trimmed = sanitizeFreeTextForFtsQuery(content);
  if (trimmed.length <= maxLen) return trimmed;
  return sanitizeFreeTextForFtsQuery(trimmed.slice(-maxLen));
}
