import { z } from "zod";

export const todoStatusSchema = z.enum(["pending", "in_progress", "completed", "cancelled"]);

export const todoItemSchema = z.object({
  id: z.number(),
  content: z.string(),
  status: todoStatusSchema,
  created_at: z.string(),
  updated_at: z.string().optional(),
});

/** conversations.todos */
export const conversationTodoStoreSchema = z.object({
  items: z.array(todoItemSchema).default([]),
  next_id: z.number().int().positive().default(1),
});

export type ConversationTodosJson = z.infer<typeof conversationTodoStoreSchema>;

export const clarifyItemSchema = z.object({
  question: z.string().min(1),
  choices: z.array(z.string().min(1)).max(4).optional(),
  default: z.string().optional(),
});

/** conversations.awaiting_clarify */
export const awaitingClarifySchema = z.object({
  items: z.array(clarifyItemSchema).min(1),
  required: z.literal(true),
  asked_at: z.string().min(1),
  timeout_sec: z.number().min(60),
});

export type AwaitingClarifyJson = z.infer<typeof awaitingClarifySchema>;

export const acpTaskStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "awaiting_decision",
  "cancelled",
  "error",
]);

export const acpTaskPendingSchema = z.union([
  z.object({
    kind: z.literal("questions"),
    questions: z.array(
      z.object({
        id: z.string(),
        prompt: z.string(),
        options: z.array(z.object({ id: z.string(), label: z.string() })).default([]),
      }),
    ),
  }),
  z.object({
    kind: z.literal("plan"),
    plan: z.string(),
    planUri: z.string().optional(),
  }),
]);

/** conversations.acp_tasks — keyed by ACP conversation id */
export const acpTaskEntrySchema = z.object({
  status: acpTaskStatusSchema,
  task_id: z.string(),
  agent_name: z.string(),
  updated_at: z.string(),
  pending: z.array(acpTaskPendingSchema).optional(),
  progress_message_id: z.string().optional(),
});

export const acpTasksSchema = z.record(z.string(), acpTaskEntrySchema);
export type AcpTaskStatusJson = z.infer<typeof acpTaskStatusSchema>;
export type AcpTaskEntryJson = z.infer<typeof acpTaskEntrySchema>;
export type AcpTasksJson = z.infer<typeof acpTasksSchema>;

/** conversations.cached_toolsets — ToolSet id strings */
export const conversationCachedToolsetsSchema = z.array(z.string());
export type ConversationCachedToolsetsJson = z.infer<typeof conversationCachedToolsetsSchema>;

/** conversations.staged_toolsets — toolset_load pending promote */
export const conversationStagedToolsetsSchema = z.array(z.string());
export type ConversationStagedToolsetsJson = z.infer<typeof conversationStagedToolsetsSchema>;

/** conversations.functions — executable tool names */
export const conversationFunctionsSchema = z.array(z.string());
export type ConversationFunctionsJson = z.infer<typeof conversationFunctionsSchema>;

export const conversationGoalStatusSchema = z.enum(["active", "paused", "completed", "exhausted"]);

/** conversations.goal — conversation-level persistent goal for auto-continue loop */
export const conversationGoalSchema = z.object({
  description: z.string().min(1),
  subgoals: z.array(z.string()).default([]),
  status: conversationGoalStatusSchema,
  turn_count: z.number().int().nonnegative().default(0),
  max_turns: z.number().int().positive().default(20),
  last_judge_reason: z.string().optional(),
  set_at: z.string().min(1),
  completed_at: z.string().optional(),
});

export type ConversationGoalJson = z.infer<typeof conversationGoalSchema>;
export type ConversationGoalStatusJson = z.infer<typeof conversationGoalStatusSchema>;
