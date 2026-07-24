import {
  analyzeCompression,
  buildCompressOptionsResolved,
  flushCompressionSummaries,
  getCompressionConfig,
  parseCompressionState,
  resolveSummarizeCut,
  scheduleCompressionSummary,
} from "@freeanima/host/core/compress";
import type { ToolSetRegistry } from "@freeanima/host/core/tool";
import { getActiveRuntimeConfig, getProfileHopModel } from "@freeanima/host/core/config";
import { PROFILE_CHAT } from "@freeanima/host/core/provider";
import type {
  CompressionState,
  StoredMessage,
  ConversationMetaLoadResult,
} from "@freeanima/host/core/db/domain";
import { isConversationMeta } from "@freeanima/host/core/db/domain";
import {
  load,
  loadConversationMeta,
  loadConversationTools,
  updateConversationMetaField,
} from "../conversation/conversation-crud.ts";
import type { CompressionAnalysis } from "@freeanima/host/core/compress";

function defaultChatModel(): string {
  return getProfileHopModel(getActiveRuntimeConfig().data, PROFILE_CHAT);
}

export type SummarizeConversationResult = {
  ok: boolean;
  enabled: boolean;
  updated: boolean;
  idle?: boolean;
  error?: "empty" | "in_progress" | "already_collapsed";
  compression: CompressionState | null;
} & Partial<CompressionAnalysis>;

/**
 * Manual Cursor-style summarize: collapse to l2=l3=cut (idle: l4), incremental summary merge, await flush.
 */
export async function summarizeConversation(
  registry: ToolSetRegistry,
  conversationId: string,
  preloaded?: { msgs: StoredMessage[]; meta: ConversationMetaLoadResult },
): Promise<SummarizeConversationResult> {
  const cfg = getCompressionConfig();
  if (!cfg.enabled) {
    return {
      ok: true,
      enabled: false,
      updated: false,
      compression: null,
    };
  }

  const msgs = preloaded?.msgs ?? (await load(conversationId));
  const meta = preloaded?.meta ?? (await loadConversationMeta(conversationId));
  if (!isConversationMeta(meta)) {
    return {
      ok: false,
      enabled: true,
      updated: false,
      compression: null,
    };
  }

  const prevState = parseCompressionState(meta.compression);
  const prevL2 = prevState?.l2 ?? 0;

  const cutResult = resolveSummarizeCut(msgs);
  if (!cutResult.ok) {
    return {
      ok: false,
      enabled: true,
      updated: false,
      error: cutResult.error,
      compression: prevState,
    };
  }

  const { cut, idle } = cutResult;
  if (cut <= prevL2 && prevState?.summary?.trim()) {
    return {
      ok: false,
      enabled: true,
      updated: false,
      error: "already_collapsed",
      idle,
      compression: prevState,
    };
  }

  const newState: CompressionState = {
    l2: cut,
    l3: cut,
    summary: prevState?.summary,
    summary_at: prevState?.summary_at,
  };

  const systemSnapshot = meta.system_prompt ?? "";
  const model = meta.model ?? defaultChatModel();
  const toolSchemas = await loadConversationTools(registry, conversationId, meta);
  const compressOpts = await buildCompressOptionsResolved(meta, newState, defaultChatModel(), {
    tools: toolSchemas,
  });

  await updateConversationMetaField(conversationId, { compression: newState });
  scheduleCompressionSummary(conversationId, prevState, newState, systemSnapshot, model);
  await flushCompressionSummaries(conversationId);

  const metaAfter = await loadConversationMeta(conversationId);
  const finalState = isConversationMeta(metaAfter)
    ? parseCompressionState(metaAfter.compression)
    : newState;

  const analysis = analyzeCompression(msgs, {
    ...compressOpts,
    state: finalState,
  });

  return {
    ...analysis,
    ok: true,
    enabled: true,
    updated: true,
    idle,
    compression: finalState,
  };
}
