import { createHook, type HookEffectOf } from "@freeanima/habitat/kernel/hooks";
import type { StoredMessage } from "@freeanima/habitat/core/db/domain";
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
  /** When true, handlers may fill llmDebugExtras for the next llm_debug snapshot */
  llm_debug?: boolean;
  /** Opaque bag; passive recall writes `passive_recall` when llm_debug */
  llmDebugExtras?: Record<string, unknown>;
};

export const toolAfterCall = createHook<ToolAfterCallContext, ToolAfterCallEffect>(
  "@freeanima/habitat/kernel/loop-mechanism-hooks/tool-after-call",
  "After tool call returns",
);

export const beforeLlmCall = createHook<BeforeLlmCallContext>(
  "@freeanima/habitat/kernel/loop-mechanism-hooks/before-llm-call",
  "Fires before each LLM call (first loop iteration and every subsequent iteration)",
);

export type { HookEffectOf };
