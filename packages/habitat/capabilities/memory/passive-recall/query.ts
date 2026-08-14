import { stripUserTimePrefix } from "@freeanima/habitat/core/hooks/prompt";

export const PASSIVE_RECALL_QUERY_MAX = 320;

/** Strip runtime-only time tag before using user text as a recall query. */
export function stripTimePrefixFromUserContent(content: string): string {
  return stripUserTimePrefix(content);
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
