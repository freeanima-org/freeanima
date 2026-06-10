import { createHook } from "./hook.ts";
import type { TurnControl } from "./hook-stream.ts";

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

export type BeforeLlmCallContext = {
  sessionId: string;
  messages: { role: string; content: string | null }[];
};

export const messageIncoming = createHook<MessageIncomingContext>(
  "@freeanima/kernel-hooks/hooks/message-incoming",
  "入站消息拦截",
);

export const toolAfterCall = createHook<ToolAfterCallContext>(
  "@freeanima/kernel-hooks/hooks/tool-after-call",
  "工具调用返回后",
);

export const turnAfterComplete = createHook<TurnAfterCompleteContext>(
  "@freeanima/kernel-hooks/hooks/turn-after-complete",
  "单轮对话结束后",
);

export const beforeLlmCall = createHook<BeforeLlmCallContext>(
  "@freeanima/kernel-hooks/hooks/before-llm-call",
  "每轮 LLM 调用前触发（首轮及工具循环每轮均触发）",
);
