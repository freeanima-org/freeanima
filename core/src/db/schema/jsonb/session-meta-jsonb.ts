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

/** sessions.acp_tasks — keyed by ACP session id */
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
 * 读路径兼容：存量 session JSONB 可能仍用 agent 名键 + 字符串 ACP session id。
 * 审计结论（2026-06-16）：保留至显式 PG 数据迁移；不可仅因代码清理删除。
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
 * 读路径兼容：存量 session JSONB 可能仍存 OpenAI tool schema 数组而非工具名字符串。
 * 审计结论（2026-06-16）：保留至显式 PG 数据迁移；不可仅因代码清理删除。
 */
export function normalizeSessionToolNames(raw: unknown): string[] {
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

/** sessions.cached_toolsets — ToolSet names in LLM API tools */
export const sessionCachedToolsetsSchema = z.preprocess(
  normalizeSessionToolNames,
  z.array(z.string()),
);
export type SessionCachedToolsetsJson = z.infer<typeof sessionCachedToolsetsSchema>;

/** sessions.staged_toolsets — toolset_load pending promote */
export const sessionStagedToolsetsSchema = z.preprocess(
  normalizeSessionToolNames,
  z.array(z.string()),
);
export type SessionStagedToolsetsJson = z.infer<typeof sessionStagedToolsetsSchema>;

/** sessions.functions */
export const sessionFunctionsSchema = z.preprocess(normalizeSessionToolNames, z.array(z.string()));
export type SessionFunctionsJson = z.infer<typeof sessionFunctionsSchema>;
