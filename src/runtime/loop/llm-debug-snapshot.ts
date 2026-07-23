import type { LlmTurnMessage } from "@freeanima/core/provider";
import type { OpenAiToolSchema, StoredMessage } from "@freeanima/core/db/domain";
import { PASSIVE_MEMORY_CONTEXT_ASSISTANT_NAME } from "@freeanima/core/llm/runtime-system-turn";
import { storedMessagesToInvokeInput } from "@freeanima/core/llm/llm-adapt";
import { omitUndefined } from "@freeanima/core/util";
import type { PassiveRecallDebugTrace } from "@freeanima/shared/rpc-contract/frames/message";

export const LLM_DEBUG_CONTENT_MAX = 8_000;

const NOTIFICATION_CONTEXT_ASSISTANT_NAME = "notification_context";

export type LlmDebugTurnPreview = {
  role: string;
  name?: string;
  content?: string | null;
  tool_calls?: Array<{ id: string; name: string; arguments: string }>;
};

export type LlmDebugInvokePreview = {
  system_prompt?: string;
  turns: LlmDebugTurnPreview[];
};

export type LlmDebugToolPreview = OpenAiToolSchema;

export type LlmDebugRuntimeInjections = {
  passive_memory_context?: boolean;
  notification_context?: boolean;
};

export type LlmDebugSnapshot = {
  phase: "initial" | "final";
  turn_index: number;
  model: string;
  tool_count: number;
  tools: LlmDebugToolPreview[];
  invoke: LlmDebugInvokePreview;
  runtime_injections?: LlmDebugRuntimeInjections;
  passive_recall?: PassiveRecallDebugTrace;
};

function truncateText(text: string, max = LLM_DEBUG_CONTENT_MAX): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…[truncated ${text.length - max} chars]`;
}

function previewTurn(turn: LlmTurnMessage): LlmDebugTurnPreview {
  const base: LlmDebugTurnPreview = {
    role: turn.role,
    ...("name" in turn && turn.name ? { name: turn.name } : {}),
  };

  if ("content" in turn) {
    const content = turn.content;
    if (typeof content === "string" && content.length > 0) {
      base.content = truncateText(content);
    } else if (content === null) {
      base.content = null;
    }
  }

  if (turn.role === "assistant" && "tool_calls" in turn && turn.tool_calls?.length) {
    base.tool_calls = turn.tool_calls.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: truncateText(tc.function.arguments ?? "{}", 2_000),
    }));
  }

  if (turn.role === "tool" && "content" in turn && typeof turn.content === "string") {
    base.content = truncateText(turn.content);
  }

  return base;
}

function detectRuntimeInjections(messages: StoredMessage[]): LlmDebugRuntimeInjections {
  let passive_memory_context = false;
  let notification_context = false;

  for (const msg of messages) {
    if (msg.role === "assistant" && msg.name === PASSIVE_MEMORY_CONTEXT_ASSISTANT_NAME) {
      passive_memory_context = true;
    }
    if (msg.role === "assistant" && msg.name === NOTIFICATION_CONTEXT_ASSISTANT_NAME) {
      notification_context = true;
    }
  }

  return omitUndefined({
    passive_memory_context: passive_memory_context || undefined,
    notification_context: notification_context || undefined,
  });
}

function asPassiveRecallTrace(value: unknown): PassiveRecallDebugTrace | undefined {
  if (!value || typeof value !== "object") return undefined;
  return value as PassiveRecallDebugTrace;
}

/** Build ephemeral LLM invoke preview (post beforeLlmCall hooks). */
export function buildLlmDebugSnapshot(
  messages: StoredMessage[],
  toolSchemas: OpenAiToolSchema[],
  model: string,
  turnIndex: number,
  phase: "initial" | "final",
  extras?: Record<string, unknown>,
): LlmDebugSnapshot {
  const invokeInput = storedMessagesToInvokeInput(messages);
  const passive_recall = asPassiveRecallTrace(extras?.passive_recall);

  return omitUndefined({
    phase,
    turn_index: turnIndex,
    model,
    tool_count: toolSchemas.length,
    /** Full OpenAI tools[] entries as sent to the provider. */
    tools: toolSchemas,
    invoke: {
      ...(invokeInput.systemPrompt
        ? { system_prompt: truncateText(invokeInput.systemPrompt) }
        : {}),
      turns: invokeInput.turns.map(previewTurn),
    },
    runtime_injections: detectRuntimeInjections(messages),
    passive_recall,
  });
}
