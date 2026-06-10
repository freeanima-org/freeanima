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
  "Inbound message intercept",
);

export const toolAfterCall = createHook<ToolAfterCallContext>(
  "@freeanima/kernel-hooks/hooks/tool-after-call",
  "After tool call returns",
);

export const turnAfterComplete = createHook<TurnAfterCompleteContext>(
  "@freeanima/kernel-hooks/hooks/turn-after-complete",
  "After single turn ends",
);

export const beforeLlmCall = createHook<BeforeLlmCallContext>(
  "@freeanima/kernel-hooks/hooks/before-llm-call",
  "Fires before each LLM call (first turn and every tool-loop turn)",
);
