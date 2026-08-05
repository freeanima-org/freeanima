import { z } from "zod";

import {
  awaitingClarifySchema,
  compressionJsonSchema,
  conversationGoalSchema,
  conversationTodoStoreSchema,
  todoItemSchema,
  todoStatusSchema,
  clarifyItemSchema,
} from "../schema/index.ts";
import { safeParseOrNull } from "@freeanima/host/core/util";

export {
  awaitingClarifySchema,
  conversationGoalSchema,
  conversationTodoStoreSchema,
  todoItemSchema,
  todoStatusSchema,
  clarifyItemSchema,
};

export type TodoStatus = z.infer<typeof todoStatusSchema>;
export type TodoItem = z.infer<typeof todoItemSchema>;
export type ConversationTodoStore = z.infer<typeof conversationTodoStoreSchema>;
export type ClarifyItem = z.infer<typeof clarifyItemSchema>;
export type AwaitingClarify = z.infer<typeof awaitingClarifySchema>;

export const clarifyToolAwaitingResultSchema = z.object({
  status: z.literal("awaiting"),
  items: z.array(clarifyItemSchema).min(1),
  timeout_sec: z.number().min(60),
});

export const clarifyToolResolvedResultSchema = z.object({
  status: z.literal("resolved"),
  answers: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
    }),
  ),
});

export const clarifyToolResultSchema = z.union([
  clarifyToolAwaitingResultSchema,
  clarifyToolResolvedResultSchema,
  z.object({ error: z.string().min(1) }),
]);

export type ClarifyToolAwaitingResult = z.infer<typeof clarifyToolAwaitingResultSchema>;
export type ClarifyToolResolvedResult = z.infer<typeof clarifyToolResolvedResultSchema>;

/** Domain-layer compression state (`compressionJsonSchema`) */
export const compressionStateSchema = compressionJsonSchema.nullable().catch(null);

export type CompressionState = z.infer<typeof compressionJsonSchema>;

export function parseCompressionState(raw: unknown): CompressionState | null {
  const parsed = compressionJsonSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * When an incoming compression patch omits summary text, keep any existing
 * non-empty summary (and its summary_at) so concurrent boundary writes cannot
 * wipe a just-finished summary LLM result.
 */
export function mergeCompressionKeepingSummary(
  incoming: CompressionState,
  existing: CompressionState | null | undefined,
): CompressionState {
  if (incoming.summary?.trim()) return incoming;
  const keep = existing?.summary?.trim();
  if (!keep) return incoming;
  return {
    ...incoming,
    summary: keep,
    summary_at: incoming.summary_at ?? existing?.summary_at,
  };
}

export function parseConversationTodoStore(raw: unknown): ConversationTodoStore {
  const result = conversationTodoStoreSchema.safeParse(raw);
  if (result.success) return result.data;
  return { items: [], next_id: 1 };
}

export function parseAwaitingClarify(raw: unknown): AwaitingClarify | null {
  return safeParseOrNull(awaitingClarifySchema, raw);
}

export type ConversationGoal = z.infer<typeof conversationGoalSchema>;

export function parseConversationGoal(raw: unknown): ConversationGoal | null {
  return safeParseOrNull(conversationGoalSchema, raw);
}

/**
 * Conversation row projection (not a message). Was JSONL first-line
 * `{ role: "conversation_meta" }`; PG stores columns on `conversations`.
 */
export const conversationMetaSchema = z
  .object({
    model: z.string(),
    cached_toolsets: z.array(z.string()).default([]),
    staged_toolsets: z.array(z.string()).optional(),
    functions: z.array(z.string()).default([]),
    timestamp: z.string().default(""),
    platform: z.string().optional(),
    system_prompt: z.string().optional(),
    /** ISO timestamptz；上次全量构建 system_prompt（日界刷新用） */
    system_prompt_built_at: z.string().optional(),
    cwd: z.string().optional(),
    title: z.string().optional(),
    compression: z.unknown().optional(),
    platform_extra: z.record(z.string(), z.unknown()).optional(),
    debug: z.boolean().optional(),
    todos: z.unknown().optional(),
    awaiting_clarify: z.unknown().optional(),
    acp_tasks: z.record(z.string(), z.unknown()).optional(),
    acp_tasks_handled_at: z.string().optional(),
    gateway_tool_display: z.string().optional(),
    goal: z.unknown().optional(),
  })
  .passthrough();

export type ConversationMetaMessage = z.infer<typeof conversationMetaSchema>;

/** Missing conversation → empty object (not null) for load helpers */
export type ConversationMetaLoadResult = ConversationMetaMessage | Record<string, never>;

export function isConversationMeta(
  meta: ConversationMetaLoadResult,
): meta is ConversationMetaMessage {
  return typeof (meta as ConversationMetaMessage).model === "string";
}
