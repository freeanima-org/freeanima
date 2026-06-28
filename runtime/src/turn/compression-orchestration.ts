import type { ToolSetRegistry } from "@freeanima/core/tool";
import { getActiveConfig, getProfileHopModel } from "@freeanima/core/config";
import { PROFILE_CHAT } from "@freeanima/core/provider";
import {
  getCompressionConfig,
  analyzeCompression,
  compress,
  parseCompressionState,
  buildCompressOptionsResolved,
  scheduleCompressionSummary,
  flushCompressionSummaries,
  maybeApplyEmergencyCompression,
} from "@freeanima/core/compress";
import { isConversationMeta } from "@freeanima/core/db/domain";
import {
  load,
  loadConversationMeta,
  loadConversationTools,
  updateConversationMetaField,
} from "../conversation/conversation-crud.ts";
import type { StoredMessage, ConversationMetaLoadResult } from "@freeanima/core/db/domain";
import type { PgRepositories } from "@freeanima/core/repos";

function defaultChatModel(): string {
  return getProfileHopModel(getActiveConfig().data, PROFILE_CHAT);
}

export { flushCompressionSummaries, maybeApplyEmergencyCompression };

/** Maintain meta.compression from full history (no message delete; async summary on cut change) */
export async function advanceCompressionMeta(
  repos: PgRepositories,
  tools: ToolSetRegistry,
  conversationId: string,
  preloaded?: { msgs: StoredMessage[]; meta: ConversationMetaLoadResult },
): Promise<void> {
  await recompressConversation(repos, tools, conversationId, undefined, preloaded);
}

/** Recompute conversation compression (optional force ignores hysteresis) */
export async function recompressConversation(
  repos: PgRepositories,
  registry: ToolSetRegistry,
  conversationId: string,
  opts?: { force?: boolean },
  preloaded?: { msgs: StoredMessage[]; meta: ConversationMetaLoadResult },
): Promise<Record<string, unknown>> {
  const cfg = getCompressionConfig();
  const msgs = preloaded?.msgs ?? (await load(repos, conversationId));
  const meta = preloaded?.meta ?? (await loadConversationMeta(repos, conversationId));
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

  const toolSchemas = await loadConversationTools(repos, registry, conversationId, meta);
  const compressOpts = await buildCompressOptionsResolved(meta, state, defaultChatModel(), {
    force: opts?.force,
    forceEmergency: opts?.force,
    tools: toolSchemas,
  });
  const [, newState] = compress(msgs, compressOpts);

  const boundariesChanged =
    newState != null &&
    (prevState == null ||
      Number(newState.l2) !== Number(prevState.l2) ||
      Number(newState.l3) !== Number(prevState.l3));

  const prevJson = JSON.stringify(prevState);
  const newJson = JSON.stringify(newState);
  const updated = newJson !== prevJson;

  if (updated && newState) {
    if (boundariesChanged) {
      const systemSnapshot = isConversationMeta(meta) ? (meta.system_prompt ?? "") : "";
      const model = isConversationMeta(meta)
        ? meta.model
        : getProfileHopModel(getActiveConfig().data, PROFILE_CHAT);
      await updateConversationMetaField(repos, conversationId, { compression: newState });
      scheduleCompressionSummary(repos, conversationId, prevState, newState, systemSnapshot, model);
    } else {
      await updateConversationMetaField(repos, conversationId, { compression: newState });
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
