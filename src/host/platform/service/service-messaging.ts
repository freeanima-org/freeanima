import {
  executeCommand as runSlashCommand,
  resolveCommand,
  isRetryResult,
  isGoalStartResult,
  isRestartResult,
  isUpgradeResult,
  isSkillReviewResult,
  commandNeedsPreAck,
  commandNeedsMessageDelivery,
  formatCommandPreAck,
  formatCommandStreamPreAck,
  ensureCommandResultText,
} from "@freeanima/host/capabilities/tools/slash-commands";
import type { CommandDef, CommandUx } from "@freeanima/host/capabilities/tools/slash-commands";
import { messageIncoming, turnAfterComplete } from "@freeanima/host/core/hooks/conversation";
import { headOkStepData } from "@freeanima/host/kernel/hooks";
import type { StoredMessage as Message } from "@freeanima/host/core/db/domain";
import type { Kernel } from "@freeanima/host/kernel";
import { conversationUpdated } from "@freeanima/host/capabilities/memory";
import type { EngineRunControl } from "./engine-run-control.ts";
import type { ConversationManager } from "./conversation-manager.ts";
import { runExclusiveStreamTurn, streamErrorEvent, type StreamTurnHost } from "./turn-lifecycle.ts";
import { triggerConversationTitleIfFirstTurn } from "./conversation-title.ts";
import {
  applyCommandConversationEffects,
  checkPlatform,
  resolveMessagingPlatform,
} from "./service-conversations.ts";
import { collectStreamReply, type StreamEvent } from "@freeanima/host/engine/loop";
import { scheduleGracefulRestart, runAnimaCliUpgrade } from "./process-restart.ts";
import { omitUndefined } from "@freeanima/host/core/util";
import type { FullRuntimeDeps } from "./runtime-deps.ts";
import { runSkillReview } from "./skill-review-run.ts";

export type MessageSendOriginExtra = {
  llm_debug?: boolean;
  client_op_id?: string;
  expected_tail_pos?: number;
  force_tail?: boolean;
};

export type MessagingDeps = {
  runControl: EngineRunControl;
  conversationManager: ConversationManager;
  onConversationUpdated: ((sid: string) => void) | null;
  streamHost: StreamTurnHost;
};

export async function runIncomingMessageHooks(
  deps: FullRuntimeDeps,
  conversationId: string,
  message: string,
  platform: string,
): Promise<{ ok: true; message: string; expiredHint?: string } | { ok: false; reason: string }> {
  const run = await deps.kernel.hookRegistry.run(
    messageIncoming,
    {
      conversationId,
      message,
      platform,
    },
    { llm_kind: "conversation" },
  );
  if (run.blocked) {
    return { ok: false, reason: run.blockedMessage ?? "" };
  }
  const effect = headOkStepData(messageIncoming, run.chain);
  return {
    ok: true,
    message: effect?.transformedMessage ?? message,
    ...(effect?.expiredHint ? { expiredHint: effect.expiredHint } : {}),
  };
}

export async function runTurnAfterCompleteHooks(
  deps: FullRuntimeDeps,
  conversationId: string,
  messages: Message[],
  defaultContent: string,
): Promise<string> {
  const run = await deps.kernel.hookRegistry.run(
    turnAfterComplete,
    {
      conversationId,
      messages: messages,
    },
    { llm_kind: "conversation" },
  );
  const effect = headOkStepData(turnAfterComplete, run.chain);
  return effect?.displayContent ?? defaultContent;
}

export function emitSessionUpdated(
  msgDeps: {
    kernel: Kernel;
    onConversationUpdated: ((sid: string) => void) | null;
  },
  conversationId: string,
): void {
  msgDeps.kernel.hookRegistry.emit(
    conversationUpdated,
    { conversation_id: conversationId },
    { llm_kind: "conversation" },
  );
  msgDeps.onConversationUpdated?.(conversationId);
}

async function isClientOpTurnComplete(
  deps: FullRuntimeDeps,
  conversationId: string,
  client_op_id: string,
): Promise<boolean> {
  const existing = await deps.conversation.findUserMessageByClientOpId(
    conversationId,
    client_op_id,
  );
  if (!existing || existing.pos === undefined) return false;
  const msgs = await deps.conversation.load(conversationId);
  const idx = msgs.findIndex((m) => m.pos === existing.pos);
  if (idx < 0) return false;
  const after = msgs.slice(idx + 1);
  return after.some(
    (m) => m.role === "assistant" && typeof m.content === "string" && m.content.length > 0,
  );
}

function parseMessageSendOriginExtra(
  origin_extra?: Record<string, unknown>,
): MessageSendOriginExtra | undefined {
  if (!origin_extra) return undefined;
  return omitUndefined({
    llm_debug: origin_extra.llm_debug === true ? true : undefined,
    client_op_id:
      typeof origin_extra.client_op_id === "string" ? origin_extra.client_op_id : undefined,
    expected_tail_pos:
      typeof origin_extra.expected_tail_pos === "number"
        ? origin_extra.expected_tail_pos
        : undefined,
    force_tail: origin_extra.force_tail === true ? true : undefined,
  });
}

export async function executeCommand(
  deps: FullRuntimeDeps,
  msgDeps: MessagingDeps,
  params: {
    conversation_id: string;
    text: string;
    platform?: string;
    origin_extra?: Record<string, unknown>;
  },
): Promise<{ text: string; data: unknown; found: boolean; ux?: CommandUx }> {
  const conversationId = params.conversation_id;
  const platform = params.platform ?? "gateway";
  const text = params.text.trim();
  const [cmd, args] = resolveCommand(text, platform);

  if (!cmd) {
    if (text.startsWith("/")) {
      const cmdName = text.split(/\s/)[0] ?? "/?";
      return {
        text: `❌ Unknown command: ${cmdName}. Type /help for available commands.`,
        data: null,
        found: true,
        ux: "toast",
      };
    }
    return { text: "", data: null, found: false };
  }

  const result = await runSlashCommand(
    cmd,
    omitUndefined({
      conversationId,
      platform,
      args,
      raw: text,
      origin_extra: params.origin_extra,
    }),
  );
  await applyCommandConversationEffects(
    deps,
    result,
    conversationId,
    platform,
    params.origin_extra,
  );

  if (isRetryResult(result)) {
    try {
      const preAck = result.text.trim() ? "" : formatCommandStreamPreAck(cmd);
      const reply = await collectStreamReply(runRetryStream(deps, msgDeps, conversationId));
      const combined = [preAck, reply].filter(Boolean).join("\n\n").trim();
      return {
        text: combined || ensureCommandResultText("", cmd),
        data: result.data,
        found: true,
        ...(result.ux !== undefined ? { ux: result.ux } : {}),
      };
    } catch (e) {
      return {
        text: `⚠️ ${e instanceof Error ? e.message : String(e)}`,
        data: result.data,
        found: true,
        ux: "toast",
      };
    }
  }

  if (isGoalStartResult(result)) {
    try {
      const reply = await collectStreamReply(
        runGoalStartStream(deps, msgDeps, conversationId, result.data.prompt),
      );
      const combined = result.text ? `${result.text}\n\n${reply}`.trim() : reply;
      return {
        text: combined || ensureCommandResultText("", cmd),
        data: result.data,
        found: true,
        ...(result.ux !== undefined ? { ux: result.ux } : {}),
      };
    } catch (e) {
      return {
        text: `⚠️ ${e instanceof Error ? e.message : String(e)}`,
        data: result.data,
        found: true,
        ux: "toast",
      };
    }
  }

  if (isRestartResult(result) || isUpgradeResult(result)) {
    scheduleGracefulRestart(
      msgDeps.runControl,
      omitUndefined({
        beforeRestart: isUpgradeResult(result) ? runAnimaCliUpgrade : undefined,
      }),
    );
    return {
      text: ensureCommandResultText(result.text, cmd),
      data: result.data,
      found: true,
      ux: result.ux ?? "toast",
    };
  }

  if (isSkillReviewResult(result)) {
    try {
      const msgs =
        result.data.mode === "evolve" ? await deps.conversation.load(conversationId) : undefined;
      const outcome = await runSkillReview(
        deps,
        omitUndefined({
          mode: result.data.mode,
          conversationId,
          msgs,
          force: result.data.force === true ? true : undefined,
          note: result.data.note,
        }),
      );
      const detail = outcome.ran
        ? outcome.result.status === "ok"
          ? `done (${outcome.result.toolCalls} tool calls, ${outcome.result.durationMs}ms)`
          : `error: ${outcome.result.error ?? outcome.result.output}`
        : `skipped: ${outcome.reason}`;
      return {
        text: `${ensureCommandResultText(result.text, cmd)} ${detail}`.trim(),
        data: result.data,
        found: true,
        ux: result.ux ?? "toast",
      };
    } catch (e) {
      return {
        text: `⚠️ Skill review failed: ${e instanceof Error ? e.message : String(e)}`,
        data: result.data,
        found: true,
        ux: "toast",
      };
    }
  }

  return {
    text: ensureCommandResultText(result.text, cmd),
    data: result.data ?? null,
    found: true,
    ux: result.ux ?? "panel",
  };
}

export type ConversationCommandRpcResult =
  | { delivery: "message" }
  | {
      delivery: "rpc";
      ux: CommandUx;
      text: string;
      command: string;
    };

/**
 * Chat terminal slash path: run without message stream, or ask client to use message.send.
 */
export async function runConversationCommand(
  deps: FullRuntimeDeps,
  msgDeps: MessagingDeps,
  params: {
    conversation_id: string;
    text: string;
    platform?: string;
    origin_extra?: Record<string, unknown>;
  },
): Promise<ConversationCommandRpcResult> {
  const conversationId = params.conversation_id;
  const platform = params.platform ?? "chat";
  const text = params.text.trim();
  const [cmd, args] = resolveCommand(text, platform);

  if (!cmd) {
    if (text.startsWith("/")) {
      const cmdName = text.split(/\s/)[0] ?? "/?";
      return {
        delivery: "rpc",
        ux: "toast",
        text: `❌ Unknown command: ${cmdName}. Type /help for available commands.`,
        command: cmdName.replace(/^\//, "") || "?",
      };
    }
    return { delivery: "message" };
  }

  if (commandNeedsMessageDelivery(cmd, args)) {
    return { delivery: "message" };
  }

  if (!(await deps.conversation.conversationExists(conversationId))) {
    return {
      delivery: "rpc",
      ux: "toast",
      text: `Conversation not found: ${conversationId}`,
      command: cmd.name,
    };
  }

  const executed = await executeCommand(
    deps,
    msgDeps,
    omitUndefined({
      conversation_id: conversationId,
      text,
      platform,
      origin_extra: params.origin_extra,
    }),
  );

  return {
    delivery: "rpc",
    ux: executed.ux ?? "panel",
    text: executed.text,
    command: cmd.name,
  };
}
export async function* sendMessageStream(
  deps: FullRuntimeDeps,
  msgDeps: MessagingDeps,
  conversationId: string,
  message: string,
  platform?: string,
  origin_extra?: Record<string, unknown>,
): AsyncGenerator<StreamEvent> {
  message = message.trim();
  if (msgDeps.runControl.isShuttingDown()) {
    yield streamErrorEvent(deps, conversationId, "Server is shutting down");
    return;
  }
  if (!(await deps.conversation.conversationExists(conversationId))) {
    yield streamErrorEvent(deps, conversationId, `Conversation not found: ${conversationId}`);
    return;
  }
  if (!message) {
    yield streamErrorEvent(deps, conversationId, "message is required");
    return;
  }
  let resolvedPlatform: string;
  try {
    resolvedPlatform = await resolveMessagingPlatform(deps, conversationId, platform);
  } catch (e) {
    yield streamErrorEvent(deps, conversationId, String(e));
    return;
  }
  await checkPlatform(deps, { platform: resolvedPlatform }, conversationId);

  const [cmd, args] = resolveCommand(message, resolvedPlatform);
  if (cmd) {
    yield* dispatchCommandStream(
      deps,
      msgDeps,
      conversationId,
      resolvedPlatform,
      message,
      cmd,
      args,
      origin_extra,
    );
    return;
  }
  if (message.startsWith("/")) {
    yield {
      event: "token",
      data: {
        content: `❌ Unknown command: ${message.split(/\s/)[0]}. Type /help for available commands.`,
      },
    };
    yield { event: "done", data: {} };
    return;
  }

  const guard = await runIncomingMessageHooks(deps, conversationId, message, resolvedPlatform);
  if (!guard.ok) {
    yield { event: "token", data: { content: guard.reason } };
    yield { event: "done", data: {} };
    return;
  }
  if (guard.expiredHint) {
    yield { event: "token", data: { content: `${guard.expiredHint}\n\n` } };
  }

  const sendOpts = parseMessageSendOriginExtra(origin_extra);
  if (sendOpts?.expected_tail_pos != null && !sendOpts.force_tail) {
    const currentTail = await deps.conversation.getMaxMessagePos(conversationId);
    if (currentTail !== sendOpts.expected_tail_pos) {
      yield {
        event: "error",
        data: {
          error: "Conversation tail changed",
          code: "tail_conflict",
          current_tail_pos: currentTail,
        },
      };
      return;
    }
  }

  if (sendOpts?.client_op_id) {
    const clientOpId = sendOpts.client_op_id;
    const complete = await isClientOpTurnComplete(deps, conversationId, clientOpId);
    if (complete) {
      yield { event: "accepted", data: {} };
      yield { event: "done", data: {} };
      return;
    }
    // 弱网下在线 dispatch 与 outbox flush 可能并发同 client_op_id；
    // 若已有进行中 turn，直接幂等返回，避免 preempt 后再跑一轮。
    if (!msgDeps.runControl.tryAcquireClientOp(clientOpId)) {
      yield { event: "accepted", data: {} };
      yield { event: "done", data: {} };
      return;
    }
    try {
      yield* runTurnStream(
        deps,
        msgDeps,
        conversationId,
        guard.message,
        sendOpts?.llm_debug === true,
        sendOpts,
      );
    } finally {
      msgDeps.runControl.releaseClientOp(clientOpId);
    }
    return;
  }

  yield* runTurnStream(
    deps,
    msgDeps,
    conversationId,
    guard.message,
    sendOpts?.llm_debug === true,
    sendOpts,
  );
}

async function* dispatchCommandStream(
  deps: FullRuntimeDeps,
  msgDeps: MessagingDeps,
  conversationId: string,
  platform: string,
  raw: string,
  cmd: CommandDef,
  args: string[],
  origin_extra?: Record<string, unknown>,
): AsyncGenerator<StreamEvent> {
  if (cmd.name !== "cancel") {
    const guard = await runIncomingMessageHooks(deps, conversationId, raw, platform);
    if (!guard.ok) {
      yield { event: "token", data: { content: guard.reason } };
      yield { event: "done", data: {} };
      return;
    }
  }

  if (commandNeedsPreAck(cmd, args)) {
    yield { event: "token", data: { content: formatCommandPreAck(cmd, args, raw) } };
  }

  const result = await runSlashCommand(
    cmd,
    omitUndefined({
      conversationId,
      platform,
      args,
      raw,
      origin_extra,
    }),
  );
  await applyCommandConversationEffects(deps, result, conversationId, platform, origin_extra);

  if (isRetryResult(result)) {
    if (!result.text.trim()) {
      yield { event: "token", data: { content: formatCommandStreamPreAck(cmd) } };
    }
    try {
      yield* runRetryStream(deps, msgDeps, conversationId);
    } catch (e) {
      yield {
        event: "token",
        data: { content: `⚠️ ${e instanceof Error ? e.message : String(e)}` },
      };
      yield { event: "done", data: {} };
    }
    return;
  }
  if (isGoalStartResult(result)) {
    if (result.text) {
      yield { event: "token", data: { content: result.text } };
    }
    try {
      yield* runGoalStartStream(deps, msgDeps, conversationId, result.data.prompt);
    } catch (e) {
      yield {
        event: "token",
        data: { content: `⚠️ ${e instanceof Error ? e.message : String(e)}` },
      };
      yield { event: "done", data: {} };
    }
    return;
  }
  if (isRestartResult(result) || isUpgradeResult(result)) {
    yield { event: "token", data: { content: ensureCommandResultText(result.text, cmd) } };
    yield { event: "done", data: {} };
    scheduleGracefulRestart(
      msgDeps.runControl,
      omitUndefined({
        beforeRestart: isUpgradeResult(result) ? runAnimaCliUpgrade : undefined,
      }),
    );
    return;
  }
  yield { event: "token", data: { content: ensureCommandResultText(result.text, cmd) } };
  yield { event: "done", data: {} };
}

function runRetryStream(
  deps: FullRuntimeDeps,
  msgDeps: MessagingDeps,
  conversationId: string,
): AsyncGenerator<StreamEvent> {
  msgDeps.runControl.preemptSessionEngine(conversationId);
  return runExclusiveStreamTurn(
    deps,
    conversationId,
    async () => deps.conversation.retryTurn(conversationId),
    msgDeps.streamHost,
    msgDeps.conversationManager,
  );
}

function runGoalStartStream(
  deps: FullRuntimeDeps,
  msgDeps: MessagingDeps,
  conversationId: string,
  prompt: string,
): AsyncGenerator<StreamEvent> {
  msgDeps.runControl.preemptSessionEngine(conversationId);
  let effectiveUserText = "";
  return runExclusiveStreamTurn(
    deps,
    conversationId,
    {
      fast: async () => {
        effectiveUserText = await deps.conversation.beginTurnFast(conversationId, prompt);
        await triggerConversationTitleIfFirstTurn(deps, conversationId, effectiveUserText, {
          kernel: deps.kernel,
          onConversationUpdated: msgDeps.onConversationUpdated,
          emitSessionUpdated: (sid) => msgDeps.streamHost.emitSessionUpdated(sid),
        });
        return effectiveUserText;
      },
      prepare: async () => {
        const [runtimeMsgs, functions] = await deps.conversation.beginTurnPrepare(conversationId);
        return [runtimeMsgs, functions, effectiveUserText];
      },
    },
    msgDeps.streamHost,
    msgDeps.conversationManager,
  );
}

export function interruptSessionStream(msgDeps: MessagingDeps, conversationId: string): void {
  msgDeps.runControl.preemptSessionEngine(conversationId);
}

function runTurnStream(
  deps: FullRuntimeDeps,
  msgDeps: MessagingDeps,
  conversationId: string,
  message: string,
  llmDebug = false,
  sendOpts?: MessageSendOriginExtra,
): AsyncGenerator<StreamEvent> {
  msgDeps.runControl.preemptSessionEngine(conversationId);
  let effectiveUserText = "";
  return runExclusiveStreamTurn(
    deps,
    conversationId,
    {
      llmDebug,
      fast: async () => {
        effectiveUserText = await deps.conversation.beginTurnFast(
          conversationId,
          message,
          omitUndefined({ client_op_id: sendOpts?.client_op_id }),
        );
        await triggerConversationTitleIfFirstTurn(deps, conversationId, effectiveUserText, {
          kernel: deps.kernel,
          onConversationUpdated: msgDeps.onConversationUpdated,
          emitSessionUpdated: (sid) => msgDeps.streamHost.emitSessionUpdated(sid),
        });
        return effectiveUserText;
      },
      prepare: async () => {
        const [runtimeMsgs, functions] = await deps.conversation.beginTurnPrepare(conversationId);
        return [runtimeMsgs, functions, effectiveUserText];
      },
    },
    msgDeps.streamHost,
    msgDeps.conversationManager,
  );
}
