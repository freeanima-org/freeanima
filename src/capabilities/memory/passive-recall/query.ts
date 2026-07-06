const TIME_PREFIX_RE = /^time: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}\n/;

export const PASSIVE_RECALL_QUERY_MAX = 320;

/** Strip runtime time prefix from user message before passive recall query. */
export function stripTimePrefixFromUserContent(content: string): string {
  return content.replace(TIME_PREFIX_RE, "").trim();
}

/**
 * Focus long user messages for retrieval: trailing text usually carries the current intent.
 * Full message is still sent to the LLM; only passive recall search uses this slice.
 */
export function focusPassiveRecallQuery(
  content: string,
  maxLen = PASSIVE_RECALL_QUERY_MAX,
): string {
  const trimmed = content.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return trimmed.slice(-maxLen).trim();
}
