/**
 * Time perception module
 *
 * A digital life has no innate sense of time passing. This module injects time
 * prefixes into user messages after compression and before LLM inference so it
 * can locate messages on a timeline.
 *
 * Design principles:
 * - Do not give the digital life a false built-in sense of time
 * - Give it a watch instead
 * - Do not pollute persisted data (runtime copy only)
 * - Do not break caches (timestamps are fixed historical values)
 */

import { buildUserTimePrefixLine } from "@freeanima/habitat/core/hooks/prompt";
import {
  isUserMessage,
  type StoredMessage,
  type UserMessage,
} from "@freeanima/habitat/core/db/domain";

/**
 * Extract timestamp from a user message.
 * Message timestamps use ISO 8601 +08:00, e.g. "2026-05-20T08:02:00.000+08:00".
 * Returns null when timestamp is missing or invalid.
 */
function getMessageTimestamp(msg: UserMessage): Date | null {
  const ts = msg.timestamp;
  if (!ts || typeof ts !== "string") return null;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Inject time prefixes into user messages in a message list.
 *
 * Rules:
 * 1. Each user message with a valid timestamp → `<time>YYYY-MM-DDTHH:mm 周X</time>\n` + original text
 * 2. Missing timestamp or non-user messages → skip
 *
 * Pure function; does not mutate input.
 */
export function injectTimePrefixes(messages: StoredMessage[]): StoredMessage[] {
  const result: StoredMessage[] = [];

  for (const msg of messages) {
    if (!isUserMessage(msg)) {
      result.push(msg);
      continue;
    }

    const ts = getMessageTimestamp(msg);
    if (!ts) {
      result.push(msg);
      continue;
    }

    const prefixLine = buildUserTimePrefixLine(ts);
    if (!prefixLine) {
      result.push(msg);
      continue;
    }

    const modified: UserMessage = {
      ...msg,
      content: `${prefixLine}${msg.content}`,
    };
    result.push(modified);
  }

  return result;
}
