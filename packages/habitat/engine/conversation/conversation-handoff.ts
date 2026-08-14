import {
  generateConversationSummary,
  getL4,
  AUTO_LLM_RUN_KIND_HANDOFF_SUMMARY,
  type GenerateSummaryResult,
} from "@freeanima/habitat/core/compress";
import { isConversationMeta, parseCompressionState } from "@freeanima/habitat/core/db/domain";
import { load, loadConversationMeta } from "./conversation.ts";

/** /new etc.: read-only old conversation; generate handoff summary for new conversation (does not write old conversation) */
export async function generateConversationHandoffSummary(
  conversationId: string,
): Promise<GenerateSummaryResult> {
  const msgs = await load(conversationId);
  const l4 = getL4(msgs);
  if (l4 === 0) {
    return { ok: false, error: "No conversation content" };
  }

  const meta = await loadConversationMeta(conversationId);
  if (!isConversationMeta(meta)) {
    return { ok: false, error: "conversation does not exist" };
  }

  const prevState = parseCompressionState(meta.compression);
  const prevL2 = prevState?.l2 ?? 0;
  if (prevL2 >= l4 && prevState?.summary?.trim()) {
    return { ok: true, summary: prevState.summary.trim() };
  }

  const systemPrompt = meta.system_prompt ?? "";
  const model = meta.model;
  return generateConversationSummary(msgs, prevState, { l2: l4, l3: l4 }, systemPrompt, model, {
    parentConversationId: conversationId,
    runKind: AUTO_LLM_RUN_KIND_HANDOFF_SUMMARY,
  });
}
