import type { OpenAiToolSchema, StoredMessage } from "@freeanima/habitat/core/db/domain";
import { isConversationMeta, parseCompressionState } from "@freeanima/habitat/core/db/domain";
import {
  getConversationMeta,
  patchConversationMeta,
} from "@freeanima/habitat/core/db/pg/conversation";
import { getCompressionConfig } from "./compression-config.ts";
import { analyzeCompression, compress } from "./compressor.ts";
import { isInToolLoop } from "./compression-tool-loop.ts";
import { scheduleCompressionSummary } from "./compression-summary-scheduler.ts";

async function loadConversationMetaForEmergency(
  conversationId: string,
): Promise<{ compression: ReturnType<typeof parseCompressionState>; systemPrompt: string }> {
  const meta = await getConversationMeta(conversationId);
  if (!meta || !isConversationMeta(meta)) {
    return { compression: null, systemPrompt: "" };
  }
  return {
    compression: parseCompressionState(meta.compression),
    systemPrompt: meta.system_prompt ?? "",
  };
}

/** Tool-loop single-turn emergency: in-place trim in-memory messages */
export async function maybeApplyEmergencyCompression(
  conversationId: string,
  runtimeMessages: StoredMessage[],
  opts: { model: string; tools: OpenAiToolSchema[] },
): Promise<boolean> {
  const cfg = getCompressionConfig();
  if (!cfg.enabled) return false;
  if (isInToolLoop(runtimeMessages)) return false;

  const { compression: state, systemPrompt } =
    await loadConversationMetaForEmergency(conversationId);
  const compressOpts = {
    maxMessagePairs: cfg.maxMessagePairs,
    model: opts.model,
    systemPrompt,
    tools: opts.tools,
    state,
    forceEmergency: true,
  };
  const analysis = analyzeCompression(runtimeMessages, compressOpts);
  if (analysis.usage_ratio == null || analysis.usage_ratio < cfg.emergencyRatio) {
    return false;
  }

  const [compressed, newState] = compress(runtimeMessages, compressOpts);
  if (compressed.length >= runtimeMessages.length) return false;

  runtimeMessages.length = 0;
  runtimeMessages.push(...compressed);
  if (newState) {
    const prev = state;
    await patchConversationMeta(conversationId, { compression: newState });
    scheduleCompressionSummary(conversationId, prev, newState, systemPrompt, opts.model);
  }
  return true;
}
