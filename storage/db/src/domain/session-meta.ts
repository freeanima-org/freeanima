import { z } from "zod";

import {
  awaitingClarifySchema,
  compressionJsonSchema,
  sessionTodoStoreSchema,
  todoItemSchema,
  todoStatusSchema,
  clarifyItemSchema,
} from "../schema/index.ts";
import { safeParseOrNull } from "@freeanima/storage-util";

export {
  awaitingClarifySchema,
  sessionTodoStoreSchema,
  todoItemSchema,
  todoStatusSchema,
  clarifyItemSchema,
};

export type TodoStatus = z.infer<typeof todoStatusSchema>;
export type TodoItem = z.infer<typeof todoItemSchema>;
export type SessionTodoStore = z.infer<typeof sessionTodoStoreSchema>;
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

export function parseSessionTodoStore(raw: unknown): SessionTodoStore {
  const result = sessionTodoStoreSchema.safeParse(raw);
  if (result.success) return result.data;
  return { items: [], next_id: 1 };
}

export function parseAwaitingClarify(raw: unknown): AwaitingClarify | null {
  return safeParseOrNull(awaitingClarifySchema, raw);
}
