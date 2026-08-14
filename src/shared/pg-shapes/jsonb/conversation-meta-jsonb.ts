import { z } from "zod";

import { clarifyItemSchema } from "./clarify-item.ts";

export { clarifyItemSchema };

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

const LEGACY_ACP_TASK_UPDATED_AT = "1970-01-01T00:00:00.000Z";

/**
 * 读路径兼容：存量 acp_tasks 可能仍按 agent 名键控、值为 ACP session id 字符串
 *（如 `{ cursor: "acp-uuid" }`）。归一化为以 ACP session id 为键的 entry。
 */
export function normalizeAcpTasks(raw: unknown): unknown {
  if (raw === null || raw === undefined) return raw;
  if (typeof raw !== "object" || Array.isArray(raw)) return raw;

  const obj = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = value;
      continue;
    }
    if (typeof value === "string" && value.length > 0) {
      out[value] = {
        status: "completed",
        task_id: "legacy",
        agent_name: key,
        updated_at: LEGACY_ACP_TASK_UPDATED_AT,
      };
    }
  }
  return out;
}

export const acpTasksSchema = z.preprocess(
  normalizeAcpTasks,
  z.record(z.string(), acpTaskEntrySchema),
);
export type AcpTaskStatusJson = z.infer<typeof acpTaskStatusSchema>;
export type AcpTaskEntryJson = z.infer<typeof acpTaskEntrySchema>;
export type AcpTasksJson = z.infer<typeof acpTasksSchema>;

/**
 * 读路径兼容：存量 conversation JSONB 可能仍存 OpenAI tool schema 数组而非工具名字符串。
 * 审计结论（2026-06-16）：保留至显式 PG 数据迁移；不可仅因代码清理删除。
 */
export function normalizeConversationToolNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const names: string[] = [];
  for (const entry of raw) {
    if (typeof entry === "string" && entry.length > 0) {
      names.push(entry);
      continue;
    }
    if (entry && typeof entry === "object") {
      const fn = (entry as { function?: { name?: unknown } }).function;
      const name = fn && typeof fn === "object" ? fn.name : undefined;
      if (typeof name === "string" && name.length > 0) {
        names.push(name);
      }
    }
  }
  return names;
}

/** conversations.cached_toolsets — ToolSet id strings */
export const conversationCachedToolsetsSchema = z.preprocess(
  normalizeConversationToolNames,
  z.array(z.string()),
);
export type ConversationCachedToolsetsJson = z.infer<typeof conversationCachedToolsetsSchema>;

/** conversations.staged_toolsets — toolset_load pending promote */
export const conversationStagedToolsetsSchema = z.preprocess(
  normalizeConversationToolNames,
  z.array(z.string()),
);
export type ConversationStagedToolsetsJson = z.infer<typeof conversationStagedToolsetsSchema>;

/** conversations.functions — executable tool names */
export const conversationFunctionsSchema = z.preprocess(
  normalizeConversationToolNames,
  z.array(z.string()),
);
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
