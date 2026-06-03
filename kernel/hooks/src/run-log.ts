import type { LogAttributes } from "@freeanima/logging";
import type { Logger } from "@freeanima/logging";
import type { Hook } from "./hook.js";

type RunMeta = {
  duration_ms: number;
  handlers: number;
};

type MessageIncomingLike = {
  sessionId: string;
  message: string;
  platform: string;
  blocked?: { reason: string };
  transformedMessage?: string;
  expiredHint?: string;
};

type ToolAfterCallLike = {
  sessionId: string;
  toolName: string;
  turnControl?: { pause?: boolean };
};

type TurnAfterCompleteLike = {
  sessionId: string;
  displayContent?: string;
};

function hookBaseAttributes(hook: Hook<unknown>, meta: RunMeta): LogAttributes {
  return {
    hook: hook.qualifiedId,
    handlers: meta.handlers,
    duration_ms: Math.round(meta.duration_ms * 100) / 100,
  };
}

function asMessageIncoming(payload: unknown): MessageIncomingLike | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.sessionId !== "string" || typeof p.message !== "string") return null;
  if (typeof p.platform !== "string") return null;
  return payload as MessageIncomingLike;
}

function asToolAfterCall(payload: unknown): ToolAfterCallLike | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.sessionId !== "string" || typeof p.toolName !== "string") return null;
  return payload as ToolAfterCallLike;
}

function asTurnAfterComplete(payload: unknown): TurnAfterCompleteLike | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.sessionId !== "string") return null;
  return payload as TurnAfterCompleteLike;
}

function logMessageIncomingOutcome(
  log: Logger,
  hook: Hook<unknown>,
  payload: MessageIncomingLike,
  meta: RunMeta,
): void {
  const base = hookBaseAttributes(hook, meta);
  if (payload.blocked) {
    log.warn("入站消息被 hook 拦截", {
      ...base,
      session_id: payload.sessionId,
      platform: payload.platform,
      reason: payload.blocked.reason,
    });
    return;
  }
  if (payload.expiredHint) {
    log.info("clarify 等待已过期", {
      ...base,
      session_id: payload.sessionId,
      platform: payload.platform,
    });
    return;
  }
  if (
    payload.transformedMessage !== undefined &&
    payload.transformedMessage !== payload.message
  ) {
    log.debug("入站消息已转换", {
      ...base,
      session_id: payload.sessionId,
      platform: payload.platform,
    });
    return;
  }
  log.debug("入站消息 hook 完成", {
    ...base,
    session_id: payload.sessionId,
    platform: payload.platform,
  });
}

function logToolAfterCallOutcome(
  log: Logger,
  hook: Hook<unknown>,
  payload: ToolAfterCallLike,
  meta: RunMeta,
): void {
  const base = {
    ...hookBaseAttributes(hook, meta),
    session_id: payload.sessionId,
    tool: payload.toolName,
  };
  if (payload.turnControl?.pause) {
    log.info("工具调用后暂停回合", base);
    return;
  }
  log.debug("工具调用 hook 完成", base);
}

function logTurnAfterCompleteOutcome(
  log: Logger,
  hook: Hook<unknown>,
  payload: TurnAfterCompleteLike,
  meta: RunMeta,
): void {
  const base = {
    ...hookBaseAttributes(hook, meta),
    session_id: payload.sessionId,
    display_overridden: payload.displayContent !== undefined,
  };
  log.debug("回合结束 hook 完成", base);
}

/** 按 hook 类型记录 run 结果（不同级别） */
export function logHookRunOutcome(
  log: Logger,
  hook: Hook<unknown>,
  payload: unknown,
  meta: RunMeta,
): void {
  const incoming = asMessageIncoming(payload);
  if (incoming && hook.qualifiedId.endsWith("/message-incoming")) {
    logMessageIncomingOutcome(log, hook, incoming, meta);
    return;
  }
  const tool = asToolAfterCall(payload);
  if (tool && hook.qualifiedId.endsWith("/tool-after-call")) {
    logToolAfterCallOutcome(log, hook, tool, meta);
    return;
  }
  const turn = asTurnAfterComplete(payload);
  if (turn && hook.qualifiedId.endsWith("/turn-after-complete")) {
    logTurnAfterCompleteOutcome(log, hook, turn, meta);
    return;
  }
  log.debug("hook 执行完成", hookBaseAttributes(hook, meta));
}
