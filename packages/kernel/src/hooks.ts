import { createHook } from "@freeanima/kernel-hooks";
import type { TurnControl } from "./hook-stream.ts";

export { Hook, HookRegistry, createHook } from "@freeanima/kernel-hooks";
export type {
  HookHandler,
  PayloadOf,
  HookStepResult,
  HookStepLink,
  HookRunResult,
  HookRunMeta,
} from "@freeanima/kernel-hooks";
export {
  walkHookChain,
  walkHookChainOldestFirst,
  blockedMessageFromChain,
  headOkStepData,
} from "@freeanima/kernel-hooks";

export type MessageIncomingContext = {
  sessionId: string;
  message: string;
  platform: string;
};

export type MessageIncomingEffect = {
  transformedMessage?: string;
  expiredHint?: string;
};

export type ToolAfterCallContext = {
  sessionId: string;
  toolName: string;
  args: Record<string, unknown>;
  result: string;
};

export type ToolAfterCallEffect = {
  turnControl?: TurnControl;
};

export type TurnAfterCompleteContext = {
  sessionId: string;
  messages: Record<string, unknown>[];
};

export type TurnAfterCompleteEffect = {
  displayContent?: string;
};

/** @deprecated 使用 MessageIncomingContext */
export type MessageIncomingPayload = MessageIncomingContext;

/** @deprecated 使用 ToolAfterCallContext */
export type ToolAfterCallPayload = ToolAfterCallContext;

/** @deprecated 使用 TurnAfterCompleteContext */
export type TurnAfterCompletePayload = TurnAfterCompleteContext;

export const messageIncoming = createHook<MessageIncomingContext>(
  "@freeanima/legacy-kernel/hooks/message-incoming",
  "入站消息拦截",
);

export const toolAfterCall = createHook<ToolAfterCallContext>(
  "@freeanima/legacy-kernel/hooks/tool-after-call",
  "工具调用返回后",
);

export const turnAfterComplete = createHook<TurnAfterCompleteContext>(
  "@freeanima/legacy-kernel/hooks/turn-after-complete",
  "单轮对话结束后",
);
