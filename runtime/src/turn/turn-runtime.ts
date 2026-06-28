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
  buildCompressOptionsResolved,
  willAdvanceCompression,
} from "@freeanima/core/compress";
import { persistToolLoopRepair, REPAIR_REASON_LOST } from "@freeanima/core/llm";
import { injectTimePrefixes } from "./time-perception.ts";
import { advanceCompressionMeta } from "./compression-orchestration.ts";
import { isConversationMeta } from "@freeanima/core/db/domain";
import {
  appendMessage,
  appendUserTurn,
  countMessages,
  load,
  loadForRuntime,
  loadConversationMeta,
  loadConversationTools,
  rollbackToLastUser,
  updateConversationMeta,
} from "../conversation/conversation-crud.ts";
import type {
  StoredMessage,
  ConversationMetaLoadResult,
  OpenAiToolSchema,
} from "@freeanima/core/db/domain";

function compressionEnabled(): boolean {
  return getCompressionConfig().enabled;
}

function defaultChatModel(): string {
  return getProfileHopModel(getActiveConfig().data, PROFILE_CHAT);
}

/** Persist tool-loop repairs via engine-llm (detection) + conversation store */
export async function repairAndPersistToolLoop(
  conversationId: string,
  msgs: StoredMessage[],
  reason = REPAIR_REASON_LOST,
): Promise<boolean> {
  return persistToolLoopRepair(conversationId, msgs, load, reason);
}

async function ensureSessionToolIntegrity(
  conversationId: string,
  msgs: StoredMessage[],
): Promise<StoredMessage[]> {
  const repaired = await repairAndPersistToolLoop(conversationId, msgs);
  return repaired ? load(conversationId) : msgs;
}

async function buildRuntimeMessagesFrom(
  _conversationId: string,
  meta: ConversationMetaLoadResult,
  msgs: StoredMessage[],
  tools: OpenAiToolSchema[],
): Promise<[StoredMessage[], string[]]> {
  const functions = isConversationMeta(meta) ? meta.functions : [];
  let runtimeMsgs = msgs;
  const systemPrompt = isConversationMeta(meta) ? (meta.system_prompt ?? "") : "";

  if (compressionEnabled()) {
    const state = isConversationMeta(meta) ? parseCompressionState(meta.compression) : null;
    const compressOpts = await buildCompressOptionsResolved(meta, state, defaultChatModel(), {
      tools,
    });
    const [compressed] = compress(runtimeMsgs, compressOpts);
    runtimeMsgs = compressed;
  }

  if (isConversationMeta(meta)) {
    runtimeMsgs = stripCachedToolSetLoadRounds(runtimeMsgs, meta.cached_toolsets ?? []);
  }

  runtimeMsgs = runtimeMsgs.filter((m) => m.role !== "system");
  runtimeMsgs = injectTimePrefixes(runtimeMsgs);

  if (systemPrompt) runtimeMsgs.unshift({ role: "system", content: systemPrompt });
  return [runtimeMsgs, functions];
}

export async function buildRuntimeMessages(
  registry: ToolSetRegistry,
  conversationId: string,
): Promise<[StoredMessage[], string[]]> {
  const meta = await loadConversationMeta(conversationId);
  const msgs = await loadForRuntime(conversationId, meta);
  const toolSchemas = await loadConversationTools(registry, conversationId, meta);
  return await buildRuntimeMessagesFrom(conversationId, meta, msgs, toolSchemas);
}

async function loadMessagesForTurn(
  conversationId: string,
  meta: ConversationMetaLoadResult,
  tools: OpenAiToolSchema[],
): Promise<StoredMessage[]> {
  if (!compressionEnabled()) {
    return load(conversationId);
  }
  const state = isConversationMeta(meta) ? parseCompressionState(meta.compression) : null;
  if (!isCompressed(state)) {
    return load(conversationId);
  }
  const windowed = await loadForRuntime(conversationId, meta);
  const compressOpts = await buildCompressOptionsResolved(meta, state, defaultChatModel(), {
    tools,
  });
  if (willAdvanceCompression(windowed, compressOpts)) {
    return load(conversationId);
  }
  return windowed;
}

async function prepareTurnMessages(
  registry: ToolSetRegistry,
  conversationId: string,
  meta: ConversationMetaLoadResult,
): Promise<{ msgs: StoredMessage[]; tools: OpenAiToolSchema[] }> {
  const tools = await loadConversationTools(registry, conversationId, meta);
  let msgs = await loadMessagesForTurn(conversationId, meta, tools);
  msgs = await ensureSessionToolIntegrity(conversationId, msgs);
  const total = await countMessages(conversationId);
  if (msgs.length < total) {
    const state = isConversationMeta(meta) ? parseCompressionState(meta.compression) : null;
    const compressOpts = await buildCompressOptionsResolved(meta, state, defaultChatModel(), {
      tools,
    });
    if (willAdvanceCompression(msgs, compressOpts)) {
      msgs = await load(conversationId);
      msgs = await ensureSessionToolIntegrity(conversationId, msgs);
    }
  }
  return { msgs, tools };
}

/** 快路径：仅持久化用户消息 */
export async function beginTurnFast(conversationId: string, userText: string): Promise<string> {
  clearToolLoopSuppression(conversationId);
  return appendUserTurn(conversationId, userText);
}

/** 慢路径：加载历史、压缩、构建 runtime 消息 */
export async function beginTurnPrepare(
  registry: ToolSetRegistry,
  conversationId: string,
): Promise<[StoredMessage[], string[]]> {
  const meta = await loadConversationMeta(conversationId);
  const { msgs, tools } = await prepareTurnMessages(registry, conversationId, meta);
  await advanceCompressionMeta(registry, conversationId, { meta, msgs });
  return await buildRuntimeMessagesFrom(conversationId, meta, msgs, tools);
}

export async function beginTurn(
  registry: ToolSetRegistry,
  conversationId: string,
  userText: string,
): Promise<[StoredMessage[], string[], string]> {
  const effective = await beginTurnFast(conversationId, userText);
  const [runtimeMsgs, functions] = await beginTurnPrepare(registry, conversationId);
  return [runtimeMsgs, functions, effective];
}

function findTurnUserIndex(messages: StoredMessage[], userText: string): number {
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
  registry: ToolSetRegistry,
  conversationId: string,
  messages: StoredMessage[],
  userText: string,
  model: string,
  functions?: string[],
  skipMessageAppend = false,
): Promise<void> {
  const idx = findTurnUserIndex(messages, userText);
  if (!skipMessageAppend) {
    for (const msg of messages.slice(idx + 1)) {
      if (msg.role === "system") continue;
      await appendMessage(msg, conversationId);
    }
  }
  await updateConversationMeta(registry, conversationId, model, { functions });
}

/** Retry turn: roll back to last user without appending new user; return runtime messages */
export async function retryTurn(
  registry: ToolSetRegistry,
  conversationId: string,
): Promise<[StoredMessage[], string[], string]> {
  const effective = await rollbackToLastUser(conversationId);
  const meta = await loadConversationMeta(conversationId);
  const { msgs, tools } = await prepareTurnMessages(registry, conversationId, meta);
  await advanceCompressionMeta(registry, conversationId, { meta, msgs });
  const [runtimeMsgs, functions] = await buildRuntimeMessagesFrom(
    conversationId,
    meta,
    msgs,
    tools,
  );
  return [runtimeMsgs, functions, effective];
}
