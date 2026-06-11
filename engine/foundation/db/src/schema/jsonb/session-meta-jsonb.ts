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

export const acpTasksSchema = z.record(z.string(), acpTaskEntrySchema);
export type AcpTaskStatusJson = z.infer<typeof acpTaskStatusSchema>;
export type AcpTaskEntryJson = z.infer<typeof acpTaskEntrySchema>;
export type AcpTasksJson = z.infer<typeof acpTasksSchema>;

/** Legacy sessions.tools stored OpenAI tool schema; normalize to tool names on read */
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

/** sessions.tools */
export const sessionToolsSchema = z.preprocess(normalizeSessionToolNames, z.array(z.string()));
export type SessionToolsJson = z.infer<typeof sessionToolsSchema>;

/** sessions.loaded_tools — tools_load accumulated execution allowlist */
export const sessionLoadedToolsSchema = z.preprocess(
  normalizeSessionToolNames,
  z.array(z.string()),
);
export type SessionLoadedToolsJson = z.infer<typeof sessionLoadedToolsSchema>;

/** sessions.functions */
export const sessionFunctionsSchema = z.preprocess(normalizeSessionToolNames, z.array(z.string()));
export type SessionFunctionsJson = z.infer<typeof sessionFunctionsSchema>;
