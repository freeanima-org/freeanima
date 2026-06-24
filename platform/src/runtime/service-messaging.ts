import {
  executeCommand as runSlashCommand,
  resolveCommand,
  isRetryResult,
  isGoalStartResult,
  isRestartResult,
  isUpgradeResult,
} from "@freeanima/platform/commands";
import type { CommandDef } from "@freeanima/platform/commands";
import { messageIncoming, turnAfterComplete } from "@freeanima/core/hooks/conversation";
import { headOkStepData } from "@freeanima/kernel/hooks";
import type { StoredMessage as Message } from "@freeanima/core/db/domain";
import type { EventBus } from "@freeanima/kernel/eventbus";
import { conversationUpdated } from "@freeanima/capabilities-memory";
import type { EngineRunControl } from "./engine-run-control.ts";
import type { ConversationManager } from "./conversation-manager.ts";
import { runExclusiveStreamTurn, streamErrorEvent, type StreamTurnHost } from "./turn-lifecycle.ts";
import { maybeGenerateConversationTitleAsync } from "./conversation-title.ts";
import {
  applyCommandConversationEffects,
  checkPlatform,
  resolveMessagingPlatform,
} from "./service-conversations.ts";
import { collectStreamReply, type StreamEvent } from "@freeanima/runtime/loop";
import { scheduleGracefulRestart, runAnimaCliUpgrade } from "./process-restart.ts";
import type { FullRuntimeDeps } from "./runtime-deps.ts";

export type MessagingDeps = {
  runControl: EngineRunControl;
  conversationManager: ConversationManager;
  bus: EventBus | null;
  onConversationUpdated: ((sid: string) => void) | null;
  streamHost: StreamTurnHost;
};

export async function runIncomingMessageHooks(
  deps: FullRuntimeDeps,
  conversationId: string,
  message: string,
  platform: string,
): Promise<{ ok: true; message: string; expiredHint?: string } | { ok: false; reason: string }> {
  const run = await deps.kernel.hookRegistry.run(messageIncoming, {
    conversationId,
    message,
    platform,
  });
  if (run.blocked) {
    return { ok: false, reason: run.blockedMessage ?? "" };
  }
  const effect = headOkStepData(messageIncoming, run.chain);
  return {
    ok: true,
    message: effect?.transformedMessage ?? message,
    expiredHint: effect?.expiredHint,
  };
}

export async function runTurnAfterCompleteHooks(
  deps: FullRuntimeDeps,
  conversationId: string,
  messages: Message[],
  defaultContent: string,
): Promise<string> {
  const run = await deps.kernel.hookRegistry.run(turnAfterComplete, {
    conversationId,
    messages: messages as Record<string, unknown>[],
  });
  const effect = headOkStepData(turnAfterComplete, run.chain);
  return effect?.displayContent ?? defaultContent;
}

export function emitSessionUpdated(
  msgDeps: Pick<MessagingDeps, "bus" | "onConversationUpdated">,
  conversationId: string,
): void {
  msgDeps.bus?.emit(conversationUpdated, { conversation_id: conversationId });
  msgDeps.onConversationUpdated?.(conversationId);
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
): Promise<{ text: string; data: unknown; found: boolean }> {
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
      };
    }
    return { text: "", data: null, found: false };
  }

  const result = await runSlashCommand(cmd, {
    conversationId,
    platform,
    args,
    raw: text,
    origin_extra: params.origin_extra,
  });
  await applyCommandConversationEffects(
    deps,
    result,
    conversationId,
    platform,
    params.origin_extra,
  );

  if (isRetryResult(result)) {
    try {
      const reply = await collectStreamReply(runRetryStream(deps, msgDeps, conversationId));
      return { text: reply, data: result.data, found: true };
    } catch (e) {
      return { text: `⚠️ ${e}`, data: result.data, found: true };
    }
  }

  if (isGoalStartResult(result)) {
    try {
      const reply = await collectStreamReply(
        runGoalStartStream(deps, msgDeps, conversationId, result.data.prompt),
      );
      const combined = result.text ? `${result.text}\n\n${reply}`.trim() : reply;
      return { text: combined, data: result.data, found: true };
    } catch (e) {
      return { text: `⚠️ ${e}`, data: result.data, found: true };
    }
  }

  if (isRestartResult(result) || isUpgradeResult(result)) {
    scheduleGracefulRestart(msgDeps.runControl, {
      beforeRestart: isUpgradeResult(result) ? runAnimaCliUpgrade : undefined,
    });
    return { text: result.text, data: result.data, found: true };
  }

  return { text: result.text, data: result.data ?? null, found: true };
}

export async function* sendMessageStream(
  deps: FullRuntimeDeps,
  msgDeps: MessagingDeps,
  conversationId: string,
  message: string,
  platform?: string,
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

  yield* runTurnStream(deps, msgDeps, conversationId, guard.message);
}

async function* dispatchCommandStream(
  deps: FullRuntimeDeps,
  msgDeps: MessagingDeps,
  conversationId: string,
  platform: string,
  raw: string,
  cmd: CommandDef,
  args: string[],
): AsyncGenerator<StreamEvent> {
  if (cmd.name !== "cancel") {
    const guard = await runIncomingMessageHooks(deps, conversationId, raw, platform);
    if (!guard.ok) {
      yield { event: "token", data: { content: guard.reason } };
      yield { event: "done", data: {} };
      return;
    }
  }
  const result = await runSlashCommand(cmd, {
    conversationId,
    platform,
    args,
    raw,
  });
  if (isRetryResult(result)) {
    try {
      yield* runRetryStream(deps, msgDeps, conversationId);
    } catch (e) {
      yield { event: "token", data: { content: `⚠️ ${e}` } };
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
      yield { event: "token", data: { content: `⚠️ ${e}` } };
      yield { event: "done", data: {} };
    }
    return;
  }
  if (isRestartResult(result) || isUpgradeResult(result)) {
    if (result.text) {
      yield { event: "token", data: { content: result.text } };
    }
    yield { event: "done", data: {} };
    scheduleGracefulRestart(msgDeps.runControl, {
      beforeRestart: isUpgradeResult(result) ? runAnimaCliUpgrade : undefined,
    });
    return;
  }
  if (result.text) {
    yield { event: "token", data: { content: result.text } };
  }
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
        maybeGenerateConversationTitleAsync(deps, conversationId, effectiveUserText, {
          bus: msgDeps.bus,
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
): AsyncGenerator<StreamEvent> {
  msgDeps.runControl.preemptSessionEngine(conversationId);
  let effectiveUserText = "";
  return runExclusiveStreamTurn(
    deps,
    conversationId,
    {
      fast: async () => {
        effectiveUserText = await deps.conversation.beginTurnFast(conversationId, message);
        maybeGenerateConversationTitleAsync(deps, conversationId, effectiveUserText, {
          bus: msgDeps.bus,
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
