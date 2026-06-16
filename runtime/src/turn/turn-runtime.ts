import type { ToolSetRegistry } from "@freeanima/core/tool";
import { stripCachedToolSetLoadRounds } from "@freeanima/core/tool";
import { getActiveConfig, getProfileHopModel } from "@freeanima/core/config";
import { PROFILE_CHAT } from "@freeanima/core/provider";
import {
  getCompressionConfig,
  clearToolLoopSuppression,
  compress,
  isCompressed,
  parseCompressionState,
  buildCompressOptions,
  willAdvanceCompression,
} from "@freeanima/core/compress";
import { persistToolLoopRepair, REPAIR_REASON_LOST } from "@freeanima/core/llm";
import { injectTimePrefixes } from "./time-perception.ts";
import { advanceCompressionMeta } from "./compression-orchestration.ts";
import type { PgRepositories } from "@freeanima/core/repos";
import {
  isSessionMeta,
  appendMessage,
  appendUserTurn,
  countMessages,
  load,
  loadForRuntime,
  loadSessionMeta,
  loadSessionTools,
  rollbackToLastUser,
  updateSessionMeta,
  type Message,
  type SessionMessage,
  type SessionMetaLoadResult,
  type OpenAiToolSchema,
} from "@freeanima/runtime/session";

function compressionEnabled(): boolean {
  return getCompressionConfig().enabled;
}

function defaultChatModel(): string {
  return getProfileHopModel(getActiveConfig().data, PROFILE_CHAT);
}

/** Persist tool-loop repairs via engine-llm (detection) + session store */
export async function repairAndPersistToolLoop(
  repos: PgRepositories,
  session: string,
  msgs: SessionMessage[],
  reason = REPAIR_REASON_LOST,
): Promise<boolean> {
  return persistToolLoopRepair(repos, session, msgs, load, reason);
}

async function ensureSessionToolIntegrity(
  repos: PgRepositories,
  session: string,
  msgs: SessionMessage[],
): Promise<Message[]> {
  const repaired = await repairAndPersistToolLoop(repos, session, msgs);
  return repaired ? load(repos, session) : msgs;
}

function buildRuntimeMessagesFrom(
  _session: string,
  meta: SessionMetaLoadResult,
  msgs: Message[],
  tools: OpenAiToolSchema[],
): [SessionMessage[], string[]] {
  const functions = isSessionMeta(meta) ? meta.functions : [];
  let runtimeMsgs = msgs;
  const systemPrompt = isSessionMeta(meta) ? (meta.system_prompt ?? "") : "";

  if (compressionEnabled()) {
    const state = isSessionMeta(meta) ? parseCompressionState(meta.compression) : null;
    const [compressed] = compress(
      runtimeMsgs,
      buildCompressOptions(meta, state, defaultChatModel(), { tools }),
    );
    runtimeMsgs = compressed;
  }

  if (isSessionMeta(meta)) {
    runtimeMsgs = stripCachedToolSetLoadRounds(runtimeMsgs, meta.cached_toolsets ?? []);
  }

  runtimeMsgs = runtimeMsgs.filter((m) => m.role !== "system");
  runtimeMsgs = injectTimePrefixes(runtimeMsgs);

  if (systemPrompt) runtimeMsgs.unshift({ role: "system", content: systemPrompt });
  return [runtimeMsgs, functions];
}

export async function buildRuntimeMessages(
  repos: PgRepositories,
  registry: ToolSetRegistry,
  session: string,
): Promise<[SessionMessage[], string[]]> {
  const meta = await loadSessionMeta(repos, session);
  const msgs = await loadForRuntime(repos, session, meta);
  const toolSchemas = await loadSessionTools(repos, registry, session, meta);
  return buildRuntimeMessagesFrom(session, meta, msgs, toolSchemas);
}

async function loadMessagesForTurn(
  repos: PgRepositories,
  session: string,
  meta: SessionMetaLoadResult,
  tools: OpenAiToolSchema[],
): Promise<Message[]> {
  if (!compressionEnabled()) {
    return load(repos, session);
  }
  const state = isSessionMeta(meta) ? parseCompressionState(meta.compression) : null;
  if (!isCompressed(state)) {
    return load(repos, session);
  }
  const windowed = await loadForRuntime(repos, session, meta);
  const compressOpts = buildCompressOptions(meta, state, defaultChatModel(), { tools });
  if (willAdvanceCompression(windowed, compressOpts)) {
    return load(repos, session);
  }
  return windowed;
}

async function prepareTurnMessages(
  repos: PgRepositories,
  registry: ToolSetRegistry,
  session: string,
  meta: SessionMetaLoadResult,
): Promise<{ msgs: Message[]; tools: OpenAiToolSchema[] }> {
  const tools = await loadSessionTools(repos, registry, session, meta);
  let msgs = await loadMessagesForTurn(repos, session, meta, tools);
  msgs = await ensureSessionToolIntegrity(repos, session, msgs);
  const total = await countMessages(repos, session);
  if (msgs.length < total) {
    const state = isSessionMeta(meta) ? parseCompressionState(meta.compression) : null;
    const compressOpts = buildCompressOptions(meta, state, defaultChatModel(), { tools });
    if (willAdvanceCompression(msgs, compressOpts)) {
      msgs = await load(repos, session);
      msgs = await ensureSessionToolIntegrity(repos, session, msgs);
    }
  }
  return { msgs, tools };
}

/** 快路径：仅持久化用户消息 */
export async function beginTurnFast(
  repos: PgRepositories,
  session: string,
  userText: string,
): Promise<string> {
  clearToolLoopSuppression(session);
  return appendUserTurn(repos, session, userText);
}

/** 慢路径：加载历史、压缩、构建 runtime 消息 */
export async function beginTurnPrepare(
  repos: PgRepositories,
  registry: ToolSetRegistry,
  session: string,
): Promise<[SessionMessage[], string[]]> {
  const meta = await loadSessionMeta(repos, session);
  const { msgs, tools } = await prepareTurnMessages(repos, registry, session, meta);
  await advanceCompressionMeta(repos, registry, session, { meta, msgs });
  return buildRuntimeMessagesFrom(session, meta, msgs, tools);
}

export async function beginTurn(
  repos: PgRepositories,
  registry: ToolSetRegistry,
  session: string,
  userText: string,
): Promise<[SessionMessage[], string[], string]> {
  const effective = await beginTurnFast(repos, session, userText);
  const [runtimeMsgs, functions] = await beginTurnPrepare(repos, registry, session);
  return [runtimeMsgs, functions, effective];
}

function findTurnUserIndex(messages: SessionMessage[], userText: string): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg?.role === "user" && msg.content === userText) return i;
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") return i;
  }
  return -1;
}

export async function finishTurn(
  repos: PgRepositories,
  registry: ToolSetRegistry,
  session: string,
  messages: SessionMessage[],
  userText: string,
  model: string,
  functions?: string[],
  skipMessageAppend = false,
): Promise<void> {
  const idx = findTurnUserIndex(messages, userText);
  if (!skipMessageAppend) {
    for (const msg of messages.slice(idx + 1)) {
      if (msg.role === "system") continue;
      await appendMessage(repos, msg, session);
    }
  }
  await updateSessionMeta(repos, registry, session, model, { functions });
}

/** Retry turn: roll back to last user without appending new user; return runtime messages */
export async function retryTurn(
  repos: PgRepositories,
  registry: ToolSetRegistry,
  session: string,
): Promise<[SessionMessage[], string[], string]> {
  const effective = await rollbackToLastUser(repos, session);
  const meta = await loadSessionMeta(repos, session);
  const { msgs, tools } = await prepareTurnMessages(repos, registry, session, meta);
  await advanceCompressionMeta(repos, registry, session, { meta, msgs });
  const [runtimeMsgs, functions] = buildRuntimeMessagesFrom(session, meta, msgs, tools);
  return [runtimeMsgs, functions, effective];
}
