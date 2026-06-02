import { createHook } from "@freeanima/hooks";
import type { TurnControl } from "./hook-stream.js";

export { Hook, HookRegistry, createHook } from "@freeanima/hooks";
export type { HookHandler, PayloadOf } from "@freeanima/hooks";

export type MessageIncomingPayload = {
  sessionId: string;
  message: string;
  platform: string;
  blocked?: { reason: string };
  transformedMessage?: string;
  expiredHint?: string;
};

export type ToolAfterCallPayload = {
  sessionId: string;
  toolName: string;
  args: Record<string, unknown>;
  result: string;
  turnControl?: TurnControl;
};

export type TurnAfterCompletePayload = {
  sessionId: string;
  messages: Record<string, unknown>[];
  displayContent?: string;
};

/** @deprecated 使用 MessageIncomingPayload */
export type MessageIncomingContext = MessageIncomingPayload;

/** @deprecated 使用 ToolAfterCallPayload */
export type ToolAfterCallContext = ToolAfterCallPayload;

/** @deprecated 使用 TurnAfterCompletePayload */
export type TurnAfterCompleteContext = TurnAfterCompletePayload;

export const messageIncoming = createHook<MessageIncomingPayload>(
  "@freeanima/legacy-kernel/hooks/message-incoming",
  "入站消息拦截",
);

export const toolAfterCall = createHook<ToolAfterCallPayload>(
  "@freeanima/legacy-kernel/hooks/tool-after-call",
  "工具调用返回后",
);

export const turnAfterComplete = createHook<TurnAfterCompletePayload>(
  "@freeanima/legacy-kernel/hooks/turn-after-complete",
  "单轮对话结束后",
);
