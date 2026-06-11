import type { ToolSetRegistry } from "@freeanima/engine-tool";
import { getActiveConfig, getProfileHopModel } from "@freeanima/engine-config";
import { PROFILE_CHAT } from "@freeanima/engine-provider-llm";
import {
  getCompressionConfig,
  analyzeCompression,
  compress,
  parseCompressionState,
  buildCompressOptions,
  scheduleCompressionSummary,
  flushCompressionSummaries,
  maybeApplyEmergencyCompression,
} from "@freeanima/engine-compress";
import {
  isSessionMeta,
  load,
  loadSessionMeta,
  loadSessionTools,
  updateSessionMetaField,
  type Message,
  type SessionMetaLoadResult,
} from "@freeanima/engine-session";
import type { PgRepositories } from "@freeanima/engine-repos";

function defaultChatModel(): string {
  return getProfileHopModel(getActiveConfig().data, PROFILE_CHAT);
}

export { flushCompressionSummaries, maybeApplyEmergencyCompression };

/** Maintain meta.compression from full history (no message delete; async summary on cut change) */
export async function advanceCompressionMeta(
  repos: PgRepositories,
  tools: ToolSetRegistry,
  session: string,
  preloaded?: { msgs: Message[]; meta: SessionMetaLoadResult },
): Promise<void> {
  await recompressSession(repos, tools, session, undefined, preloaded);
}

/** Recompute session compression (optional force ignores hysteresis) */
export async function recompressSession(
  repos: PgRepositories,
  registry: ToolSetRegistry,
  session: string,
  opts?: { force?: boolean },
  preloaded?: { msgs: Message[]; meta: SessionMetaLoadResult },
): Promise<Record<string, unknown>> {
  const cfg = getCompressionConfig();
  const msgs = preloaded?.msgs ?? (await load(repos, session));
  const meta = preloaded?.meta ?? (await loadSessionMeta(repos, session));
  const prevState = parseCompressionState(isSessionMeta(meta) ? meta.compression : undefined);
  const state = !opts?.force && prevState ? prevState : opts?.force ? null : prevState;

  if (!cfg.enabled) {
    return {
      ok: true,
      enabled: false,
      updated: false,
      compression: null,
    };
  }

  const toolSchemas = await loadSessionTools(repos, registry, session, meta);
  const compressOpts = buildCompressOptions(meta, state, defaultChatModel(), {
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
      const systemSnapshot = isSessionMeta(meta) ? (meta.system_prompt ?? "") : "";
      const model = isSessionMeta(meta)
        ? meta.model
        : getProfileHopModel(getActiveConfig().data, PROFILE_CHAT);
      await updateSessionMetaField(repos, session, { compression: newState });
      scheduleCompressionSummary(repos, session, prevState, newState, systemSnapshot, model);
    } else {
      await updateSessionMetaField(repos, session, { compression: newState });
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
