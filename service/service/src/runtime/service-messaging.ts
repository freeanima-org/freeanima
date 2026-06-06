import {
  executeCommand as runSlashCommand,
  resolveCommand,
  isRetryResult,
} from "@freeanima/connectors-commands";
import type { CommandDef } from "@freeanima/connectors-commands";
import { getServiceContext } from "../context.ts";

function conv() {
  return getServiceContext().conversation;
}
import { headOkStepData, messageIncoming, turnAfterComplete } from "@freeanima/kernel-hooks";
import type { MessageIncomingEffect, TurnAfterCompleteEffect } from "@freeanima/kernel-hooks";
import type { SessionMessage as Message } from "@freeanima/engine-db/domain";
import type { EventBus } from "@freeanima/kernel-eventbus";
import { sessionUpdated } from "@freeanima/life-memory";
import { PARLOR_PLATFORM } from "./platforms.ts";
import type { EngineRunControl } from "./engine-run-control.ts";
import type { SessionManager } from "./session-manager.ts";
import { runExclusiveStreamTurn, streamErrorEvent, type StreamTurnHost } from "./turn-lifecycle.ts";
import { applyCommandSessionEffects, checkPlatform } from "./service-sessions.ts";
import { collectStreamReply, type StreamEvent } from "@freeanima/engine-loop";

export type MessagingDeps = {
  runControl: EngineRunControl;
  sessionManager: SessionManager;
  bus: EventBus | null;
  onSessionUpdated: ((sid: string) => void) | null;
  streamHost: StreamTurnHost;
};

export async function runIncomingMessageHooks(
  sessionId: string,
  message: string,
  platform: string,
): Promise<{ ok: true; message: string; expiredHint?: string } | { ok: false; reason: string }> {
  const run = await getServiceContext().kernel.hookRegistry.run(messageIncoming, {
    sessionId,
    message,
    platform,
  });
  if (run.blocked) {
    return { ok: false, reason: run.blockedMessage ?? "" };
  }
  const effect = (headOkStepData(run.chain) ?? {}) as MessageIncomingEffect;
  return {
    ok: true,
    message: effect.transformedMessage ?? message,
    expiredHint: effect.expiredHint,
  };
}

export async function runTurnAfterCompleteHooks(
  sessionId: string,
  messages: Message[],
  defaultContent: string,
): Promise<string> {
  const run = await getServiceContext().kernel.hookRegistry.run(turnAfterComplete, {
    sessionId,
    messages: messages as Record<string, unknown>[],
  });
  const effect = (headOkStepData(run.chain) ?? {}) as TurnAfterCompleteEffect;
  return effect.displayContent ?? defaultContent;
}

export function emitSessionUpdated(
  deps: Pick<MessagingDeps, "bus" | "onSessionUpdated">,
  sessionId: string,
): void {
  deps.bus?.emit(sessionUpdated, { session_id: sessionId });
  deps.onSessionUpdated?.(sessionId);
}

export async function executeCommand(
  deps: MessagingDeps,
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
        text: `❌ 未知命令: ${cmdName}。输入 /help 查看可用命令。`,
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
  await applyCommandSessionEffects(result, sessionId, platform, params.origin_extra);

  if (isRetryResult(result)) {
    try {
      const reply = await collectStreamReply(runRetryStream(deps, sessionId));
      return { text: reply, data: result.data, found: true };
    } catch (e) {
      return { text: `⚠️ ${e}`, data: result.data, found: true };
    }
  }

  return { text: result.text, data: result.data ?? null, found: true };
}

export async function* sendMessageStream(
  deps: MessagingDeps,
  sessionId: string,
  message: string,
  platform = PARLOR_PLATFORM,
): AsyncGenerator<StreamEvent> {
  message = message.trim();
  if (deps.runControl.isShuttingDown()) {
    yield streamErrorEvent(sessionId, "Server is shutting down");
    return;
  }
  if (!(await conv().sessionExists(sessionId))) {
    yield streamErrorEvent(sessionId, `Session not found: ${sessionId}`);
    return;
  }
  if (!message) {
    yield streamErrorEvent(sessionId, "message is required");
    return;
  }
  await checkPlatform({ platform }, sessionId);

  const [cmd, args] = resolveCommand(message, platform);
  if (cmd) {
    yield* dispatchCommandStream(deps, sessionId, platform, message, cmd, args);
    return;
  }
  if (message.startsWith("/")) {
    yield {
      event: "token",
      data: {
        content: `❌ 未知命令: ${message.split(/\s/)[0]}。输入 /help 查看可用命令。`,
      },
    };
    yield { event: "done", data: {} };
    return;
  }

  const guard = await runIncomingMessageHooks(sessionId, message, platform);
  if (!guard.ok) {
    yield { event: "token", data: { content: guard.reason } };
    yield { event: "done", data: {} };
    return;
  }
  if (guard.expiredHint) {
    yield { event: "token", data: { content: `${guard.expiredHint}\n\n` } };
  }

  yield* runTurnStream(deps, sessionId, guard.message);
}

async function* dispatchCommandStream(
  deps: MessagingDeps,
  sessionId: string,
  platform: string,
  raw: string,
  cmd: CommandDef,
  args: string[],
): AsyncGenerator<StreamEvent> {
  if (cmd.name !== "cancel") {
    const guard = await runIncomingMessageHooks(sessionId, raw, platform);
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
      yield* runRetryStream(deps, sessionId);
    } catch (e) {
      yield { event: "token", data: { content: `⚠️ ${e}` } };
      yield { event: "done", data: {} };
    }
    return;
  }
  if (result.text) {
    yield { event: "token", data: { content: result.text } };
  }
  yield { event: "done", data: {} };
}

function runRetryStream(deps: MessagingDeps, sessionId: string): AsyncGenerator<StreamEvent> {
  deps.runControl.preemptSessionEngine(sessionId);
  return runExclusiveStreamTurn(
    sessionId,
    async () => conv().retryTurn(sessionId),
    deps.streamHost,
    deps.sessionManager,
  );
}

function runTurnStream(
  deps: MessagingDeps,
  sessionId: string,
  message: string,
): AsyncGenerator<StreamEvent> {
  deps.runControl.preemptSessionEngine(sessionId);
  return runExclusiveStreamTurn(
    sessionId,
    async () => conv().beginTurn(sessionId, message),
    deps.streamHost,
    deps.sessionManager,
  );
}
