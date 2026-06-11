import type { PgRepositories } from "@freeanima/engine-repos";
import type { OpenAiToolSchema, SessionMessage } from "@freeanima/engine-db/domain";
import { isSessionMeta, parseCompressionState } from "@freeanima/engine-db/domain";
import { getCompressionConfig } from "./compression-config.ts";
import { analyzeCompression, compress } from "./compressor.ts";
import { isInToolLoop } from "./compression-tool-loop.ts";
import { scheduleCompressionSummary } from "./compression-summary-scheduler.ts";

async function loadSessionMetaForEmergency(
  repos: PgRepositories,
  session: string,
): Promise<{ compression: ReturnType<typeof parseCompressionState>; systemPrompt: string }> {
  if (!repos.pgAvailable) {
    return { compression: null, systemPrompt: "" };
  }
  const meta = await repos.session.getSessionMeta(session);
  if (!meta || !isSessionMeta(meta)) {
    return { compression: null, systemPrompt: "" };
  }
  return {
    compression: parseCompressionState(meta.compression),
    systemPrompt: meta.system_prompt ?? "",
  };
}

/** Tool-loop single-turn emergency: in-place trim in-memory messages */
export async function maybeApplyEmergencyCompression(
  repos: PgRepositories,
  session: string,
  runtimeMessages: SessionMessage[],
  opts: { model: string; tools: OpenAiToolSchema[] },
): Promise<boolean> {
  const cfg = getCompressionConfig();
  if (!cfg.enabled) return false;
  if (isInToolLoop(runtimeMessages)) return false;

  const { compression: state, systemPrompt } = await loadSessionMetaForEmergency(repos, session);
  const compressOpts = {
    maxRounds: cfg.maxRounds,
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
  if (newState && repos.pgAvailable) {
    const prev = state;
    await repos.session.patchSessionMeta(session, { compression: newState });
    scheduleCompressionSummary(repos, session, prev, newState, systemPrompt, opts.model);
  }
  return true;
}
