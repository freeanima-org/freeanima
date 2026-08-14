import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { getActiveRuntimeConfig, getProfileHopModel } from "@freeanima/habitat/core/config";
import { PROFILE_CHAT } from "@freeanima/habitat/core/provider";
import {
  getCompressionConfig,
  analyzeCompression,
  compress,
  parseCompressionState,
  buildCompressOptionsResolved,
  scheduleCompressionSummary,
  flushCompressionSummaries,
  abandonCompressionSummaries,
  maybeApplyEmergencyCompression,
} from "@freeanima/habitat/core/compress";
import { omitUndefined } from "@freeanima/habitat/core/util";
import { isConversationMeta } from "@freeanima/habitat/core/db/domain";
import {
  load,
  loadConversationMeta,
  loadConversationTools,
  updateConversationMetaField,
} from "../conversation/conversation-crud.ts";
import type { StoredMessage, ConversationMetaLoadResult } from "@freeanima/habitat/core/db/domain";

function defaultChatModel(): string {
  return getProfileHopModel(getActiveRuntimeConfig().data, PROFILE_CHAT);
}

export { abandonCompressionSummaries, flushCompressionSummaries, maybeApplyEmergencyCompression };
export {
  summarizeConversation,
  type SummarizeConversationResult,
} from "./summarize-conversation.ts";

/** Maintain meta.compression from full history (no message delete; async summary on cut change) */
export async function advanceCompressionMeta(
  tools: ToolSetRegistry,
  conversationId: string,
  preloaded?: { msgs: StoredMessage[]; meta: ConversationMetaLoadResult },
): Promise<void> {
  await recompressConversation(tools, conversationId, undefined, preloaded);
}

/** Recompute conversation compression (optional force ignores hysteresis) */
export async function recompressConversation(
  registry: ToolSetRegistry,
  conversationId: string,
  opts?: { force?: boolean },
  preloaded?: { msgs: StoredMessage[]; meta: ConversationMetaLoadResult },
): Promise<Record<string, unknown>> {
  const cfg = getCompressionConfig();
  const msgs = preloaded?.msgs ?? (await load(conversationId));
  const meta = preloaded?.meta ?? (await loadConversationMeta(conversationId));
  const prevState = parseCompressionState(isConversationMeta(meta) ? meta.compression : undefined);
  const state = !opts?.force && prevState ? prevState : opts?.force ? null : prevState;

  if (!cfg.enabled) {
    return {
      ok: true,
      enabled: false,
      updated: false,
      compression: null,
    };
  }

  const toolSchemas = await loadConversationTools(registry, conversationId, meta);
  const compressOpts = await buildCompressOptionsResolved(
    meta,
    state,
    defaultChatModel(),
    omitUndefined({
      force: opts?.force,
      forceEmergency: opts?.force,
      tools: toolSchemas,
    }),
  );
  const [, newState] = compress(msgs, compressOpts);

  const boundariesChanged =
    newState != null &&
    (prevState == null || newState.l2 !== prevState.l2 || newState.l3 !== prevState.l3);

  const prevJson = JSON.stringify(prevState);
  const newJson = JSON.stringify(newState);
  const updated = newJson !== prevJson;

  if (updated && newState) {
    if (boundariesChanged) {
      const systemSnapshot = isConversationMeta(meta) ? (meta.system_prompt ?? "") : "";
      await updateConversationMetaField(conversationId, { compression: newState });
      scheduleCompressionSummary(conversationId, prevState, newState, systemSnapshot);
    } else {
      await updateConversationMetaField(conversationId, { compression: newState });
    }
  }

  const analysis = analyzeCompression(msgs, {
    ...compressOpts,
    state: newState,
  });
  return {
    ok: true,
    updated,
    compression: newState,
    ...analysis,
  };
}
