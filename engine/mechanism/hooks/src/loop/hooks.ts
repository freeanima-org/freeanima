import { createHook, type HookEffectOf } from "@freeanima/kernel-hooks";
import type { SessionMessage } from "@freeanima/engine-db/domain";
import type { TurnControl } from "./hook-stream.ts";

export type ToolAfterCallContext = {
  sessionId: string;
  toolName: string;
  args: Record<string, unknown>;
  result: string;
};

export type ToolAfterCallEffect = {
  turnControl?: TurnControl;
};

/** Mutable messages before each LLM call (handlers may modify in place) */
export type BeforeLlmCallContext = {
  sessionId: string;
  messages: SessionMessage[];
};

export const toolAfterCall = createHook<ToolAfterCallContext, ToolAfterCallEffect>(
  "@freeanima/engine-loop-hooks/tool-after-call",
  "After tool call returns",
);

export const beforeLlmCall = createHook<BeforeLlmCallContext>(
  "@freeanima/engine-loop-hooks/before-llm-call",
  "Fires before each LLM call (first turn and every tool-loop turn)",
);

export type { HookEffectOf };
