import {
  markToolLoopActivity,
  maybeApplyEmergencyCompression,
} from "@freeanima/host/core/compress";
import type { StoredMessage } from "@freeanima/host/core/db/domain";
import type { AfterMessagesPersisted } from "./loop-engine.ts";

function batchTouchesToolLoop(batch: StoredMessage[]): boolean {
  return batch.some(
    (m) => m.role === "tool" || (m.role === "assistant" && (m.tool_calls?.length ?? 0) > 0),
  );
}

/**
 * Conversation-path side effects after loop persist: tool-loop mark + emergency compress.
 * Auto LLM / pure unit tests omit this hook (default no-op → no session PG).
 */
export function createConversationAfterMessagesPersisted(
  conversationId: string,
): AfterMessagesPersisted {
  return async ({ messages, batch, model, tools }) => {
    if (batchTouchesToolLoop(batch)) {
      markToolLoopActivity(conversationId);
    }
    await maybeApplyEmergencyCompression(conversationId, messages, { model, tools });
  };
}
