import { createHook, type HookEffectOf } from "@freeanima/kernel/hooks";
import type { StoredMessage } from "@freeanima/core/db/domain";
import type { TurnControl } from "./hook-stream.ts";

export type ToolAfterCallContext = {
  conversationId: string;
  toolName: string;
  args: Record<string, unknown>;
  result: string;
};

export type ToolAfterCallEffect = {
  turnControl?: TurnControl;
};

/** Mutable messages before each LLM call (handlers may modify in place) */
export type BeforeLlmCallContext = {
  conversationId: string;
  messages: StoredMessage[];
};

export const toolAfterCall = createHook<ToolAfterCallContext, ToolAfterCallEffect>(
  "@freeanima/runtime/loop-hooks/tool-after-call",
  "After tool call returns",
);

export const beforeLlmCall = createHook<BeforeLlmCallContext>(
  "@freeanima/runtime/loop-hooks/before-llm-call",
  "Fires before each LLM call (first turn and every tool-loop turn)",
);

export type { HookEffectOf };
