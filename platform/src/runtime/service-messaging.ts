import {
  executeCommand as runSlashCommand,
  resolveCommand,
  isRetryResult,
  isRestartResult,
  isUpdateResult,
} from "@freeanima/platform/commands";
import type { CommandDef } from "@freeanima/platform/commands";
import { messageIncoming, turnAfterComplete } from "@freeanima/core/hooks/conversation";
import { headOkStepData } from "@freeanima/kernel/hooks";
import type { SessionMessage as Message } from "@freeanima/core/db/domain";
import type { EventBus } from "@freeanima/kernel/eventbus";
import { sessionUpdated } from "@freeanima/capabilities-memory";
import { PARLOR_PLATFORM } from "./platforms.ts";
import type { EngineRunControl } from "./engine-run-control.ts";
import type { SessionManager } from "./session-manager.ts";
import { runExclusiveStreamTurn, streamErrorEvent, type StreamTurnHost } from "./turn-lifecycle.ts";
import { applyCommandSessionEffects, checkPlatform } from "./service-sessions.ts";
import { collectStreamReply, type StreamEvent } from "@freeanima/runtime/loop";
import { scheduleGracefulRestart, runAnimaCliUpdate } from "./process-restart.ts";
import type { FullRuntimeDeps } from "./runtime-deps.ts";

export type MessagingDeps = {
  runControl: EngineRunControl;
  sessionManager: SessionManager;
  bus: EventBus | null;
  onSessionUpdated: ((sid: string) => void) | null;
  streamHost: StreamTurnHost;
};

export async function runIncomingMessageHooks(
  deps: FullRuntimeDeps,
  sessionId: string,
  message: string,
  platform: string,
): Promise<{ ok: true; message: string; expiredHint?: string } | { ok: false; reason: string }> {
  const run = await deps.kernel.hookRegistry.run(messageIncoming, {
    sessionId,
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
  sessionId: string,
  messages: Message[],
  defaultContent: string,
): Promise<string> {
  const run = await deps.kernel.hookRegistry.run(turnAfterComplete, {
    sessionId,
    messages: messages as Record<string, unknown>[],
  });
  const effect = headOkStepData(turnAfterComplete, run.chain);
  return effect?.displayContent ?? defaultContent;
}

export function emitSessionUpdated(
  msgDeps: Pick<MessagingDeps, "bus" | "onSessionUpdated">,
  sessionId: string,
): void {
  msgDeps.bus?.emit(sessionUpdated, { session_id: sessionId });
  msgDeps.onSessionUpdated?.(sessionId);
}

export async function executeCommand(
  deps: FullRuntimeDeps,
  msgDeps: MessagingDeps,
  params: {
    session_id: string;
    text: string;
    platform?: string;
    origin_extra?: Record<string, unknown>;
  },
): Promise<{ text: string; data: unknown; found: boolean }> {
  const sessionId = params.session_id;
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
    sessionId,
    platform,
    args,
    raw: text,
    origin_extra: params.origin_extra,
  });
  await applyCommandSessionEffects(deps, result, sessionId, platform, params.origin_extra);

  if (isRetryResult(result)) {
    try {
      const reply = await collectStreamReply(runRetryStream(deps, msgDeps, sessionId));
      return { text: reply, data: result.data, found: true };
    } catch (e) {
      return { text: `⚠️ ${e}`, data: result.data, found: true };
    }
  }

  if (isRestartResult(result) || isUpdateResult(result)) {
    scheduleGracefulRestart(msgDeps.runControl, {
      beforeRestart: isUpdateResult(result) ? runAnimaCliUpdate : undefined,
    });
    return { text: result.text, data: result.data, found: true };
  }

  return { text: result.text, data: result.data ?? null, found: true };
}

export async function* sendMessageStream(
  deps: FullRuntimeDeps,
  msgDeps: MessagingDeps,
  sessionId: string,
  message: string,
  platform = PARLOR_PLATFORM,
): AsyncGenerator<StreamEvent> {
  message = message.trim();
  if (msgDeps.runControl.isShuttingDown()) {
    yield streamErrorEvent(deps, sessionId, "Server is shutting down");
    return;
  }
  if (!(await deps.conversation.sessionExists(sessionId))) {
    yield streamErrorEvent(deps, sessionId, `Session not found: ${sessionId}`);
    return;
  }
  if (!message) {
    yield streamErrorEvent(deps, sessionId, "message is required");
    return;
  }
  await checkPlatform(deps, { platform }, sessionId);

  const [cmd, args] = resolveCommand(message, platform);
  if (cmd) {
    yield* dispatchCommandStream(deps, msgDeps, sessionId, platform, message, cmd, args);
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

  const guard = await runIncomingMessageHooks(deps, sessionId, message, platform);
  if (!guard.ok) {
    yield { event: "token", data: { content: guard.reason } };
    yield { event: "done", data: {} };
    return;
  }
  if (guard.expiredHint) {
    yield { event: "token", data: { content: `${guard.expiredHint}\n\n` } };
  }

  yield* runTurnStream(deps, msgDeps, sessionId, guard.message);
}

async function* dispatchCommandStream(
  deps: FullRuntimeDeps,
  msgDeps: MessagingDeps,
  sessionId: string,
  platform: string,
  raw: string,
  cmd: CommandDef,
  args: string[],
): AsyncGenerator<StreamEvent> {
  if (cmd.name !== "cancel") {
    const guard = await runIncomingMessageHooks(deps, sessionId, raw, platform);
    if (!guard.ok) {
      yield { event: "token", data: { content: guard.reason } };
      yield { event: "done", data: {} };
      return;
    }
  }
  const result = await runSlashCommand(cmd, {
    sessionId,
    platform,
    args,
    raw,
  });
  if (isRetryResult(result)) {
    try {
      yield* runRetryStream(deps, msgDeps, sessionId);
    } catch (e) {
      yield { event: "token", data: { content: `⚠️ ${e}` } };
      yield { event: "done", data: {} };
    }
    return;
  }
  if (isRestartResult(result) || isUpdateResult(result)) {
    if (result.text) {
      yield { event: "token", data: { content: result.text } };
    }
    yield { event: "done", data: {} };
    scheduleGracefulRestart(msgDeps.runControl, {
      beforeRestart: isUpdateResult(result) ? runAnimaCliUpdate : undefined,
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
  sessionId: string,
): AsyncGenerator<StreamEvent> {
  msgDeps.runControl.preemptSessionEngine(sessionId);
  return runExclusiveStreamTurn(
    deps,
    sessionId,
    async () => deps.conversation.retryTurn(sessionId),
    msgDeps.streamHost,
    msgDeps.sessionManager,
  );
}

function runTurnStream(
  deps: FullRuntimeDeps,
  msgDeps: MessagingDeps,
  sessionId: string,
  message: string,
): AsyncGenerator<StreamEvent> {
  msgDeps.runControl.preemptSessionEngine(sessionId);
  let effectiveUserText = "";
  return runExclusiveStreamTurn(
    deps,
    sessionId,
    {
      fast: async () => {
        effectiveUserText = await deps.conversation.beginTurnFast(sessionId, message);
        return effectiveUserText;
      },
      prepare: async () => {
        const [runtimeMsgs, functions] = await deps.conversation.beginTurnPrepare(sessionId);
        return [runtimeMsgs, functions, effectiveUserText];
      },
    },
    msgDeps.streamHost,
    msgDeps.sessionManager,
  );
}
