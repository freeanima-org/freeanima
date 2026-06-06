import { z } from "zod";

export const todoStatusSchema = z.enum(["pending", "in_progress", "completed", "cancelled"]);

export const todoItemSchema = z.object({
  id: z.number(),
  content: z.string(),
  status: todoStatusSchema,
  created_at: z.string(),
  updated_at: z.string().optional(),
});

/** sessions.todos */
export const sessionTodoStoreSchema = z.object({
  items: z.array(todoItemSchema).default([]),
  next_id: z.number().int().positive().default(1),
});

export type SessionTodosJson = z.infer<typeof sessionTodoStoreSchema>;

export const clarifyItemSchema = z.object({
  question: z.string().min(1),
  choices: z.array(z.string().min(1)).max(4).optional(),
  default: z.string().optional(),
});

/** sessions.awaiting_clarify */
export const awaitingClarifySchema = z.object({
  items: z.array(clarifyItemSchema).min(1),
  required: z.literal(true),
  asked_at: z.string().min(1),
  timeout_sec: z.number().min(60),
});

export type AwaitingClarifyJson = z.infer<typeof awaitingClarifySchema>;

/** sessions.acp_sessions */
export const acpSessionsSchema = z.record(z.string(), z.string());
export type AcpSessionsJson = z.infer<typeof acpSessionsSchema>;

/** sessions.tools */
export const sessionToolsSchema = z.array(z.string());
export type SessionToolsJson = z.infer<typeof sessionToolsSchema>;

/** sessions.functions */
export const sessionFunctionsSchema = z.array(z.string());
export type SessionFunctionsJson = z.infer<typeof sessionFunctionsSchema>;
