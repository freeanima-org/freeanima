import { defineToolReturn, type ToolReturnContractFields, z } from "@freeanima/core/tool";
import { TASK_PRIORITIES, TASK_STATUSES } from "@freeanima/core/repos";

const taskRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  due_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  completed_at: z.string().nullable(),
  source_conversation_id: z.string().nullable(),
});

const taskMutationSchema = z.object({
  ok: z.literal(true),
  task: taskRowSchema,
  action: z.string(),
});

const exampleTask = {
  id: "task-001",
  title: "Example task",
  description: null,
  status: "pending" as const,
  priority: "none" as const,
  due_at: null,
  created_at: "2026-06-10T10:00:00+08:00",
  updated_at: "2026-06-10T10:00:00+08:00",
  completed_at: null,
  source_conversation_id: "sess-001",
};

export const TASKS_TOOL_RETURNS: Record<string, ToolReturnContractFields> = {
  task_create: defineToolReturn({
    schema: taskMutationSchema,
    example: { ok: true, task: exampleTask, action: "create" },
  }),
  task_update: defineToolReturn({
    schema: taskMutationSchema,
    example: { ok: true, task: exampleTask, action: "update" },
  }),
  task_complete: defineToolReturn({
    schema: taskMutationSchema,
    example: {
      ok: true,
      task: { ...exampleTask, status: "completed" },
      action: "complete",
    },
  }),
  task_cancel: defineToolReturn({
    schema: taskMutationSchema,
    example: {
      ok: true,
      task: { ...exampleTask, status: "cancelled" },
      action: "cancel",
    },
  }),
  task_reopen: defineToolReturn({
    schema: taskMutationSchema,
    example: { ok: true, task: exampleTask, action: "reopen" },
  }),
  task_list: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("list"),
      count: z.number(),
      tasks: z.array(taskRowSchema),
    }),
    example: {
      ok: true,
      action: "list",
      count: 1,
      tasks: [exampleTask],
    },
  }),
  task_get: defineToolReturn({
    schema: taskMutationSchema,
    example: { ok: true, task: exampleTask, action: "get" },
  }),
};
