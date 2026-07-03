import { defineToolReturn, type ToolReturnContractFields, z } from "@freeanima/core/tool";

const taskItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
  status: z.enum(["pending", "completed"]),
  priority: z.enum(["high", "medium", "low", "none"]),
  due_at: z.string().nullable(),
  remind_at: z.string().nullable(),
  list_id: z.number(),
  sort_order: z.number(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const taskListSchema = z.object({
  id: z.number(),
  name: z.string(),
  sort_order: z.number(),
  closed: z.boolean(),
  is_default: z.boolean(),
  is_folder: z.boolean(),
  parent_id: z.number().nullable(),
  item_count: z.number(),
});

const exampleItem = {
  id: 10,
  title: "示例任务",
  content: "任务详情",
  tags: ["工作"],
  status: "pending" as const,
  priority: "none" as const,
  due_at: null,
  remind_at: null,
  list_id: 2,
  sort_order: 0,
  completed_at: null,
  created_at: "2026-06-10T10:00:00+08:00",
  updated_at: "2026-06-10T10:00:00+08:00",
};

const exampleList = {
  id: 2,
  name: "收件箱",
  sort_order: 0,
  closed: false,
  is_default: true,
  is_folder: false,
  parent_id: null,
  item_count: 1,
};

export const TASK_TOOL_RETURNS: Record<string, ToolReturnContractFields> = {
  task_create: defineToolReturn({
    schema: z.object({ ok: z.literal(true), action: z.string(), item: taskItemSchema }),
    example: { ok: true, action: "create", item: exampleItem },
  }),
  task_update: defineToolReturn({
    schema: z.object({ ok: z.literal(true), action: z.string(), item: taskItemSchema }),
    example: { ok: true, action: "update", item: exampleItem },
  }),
  task_complete: defineToolReturn({
    schema: z.object({ ok: z.literal(true), action: z.string(), item: taskItemSchema }),
    example: {
      ok: true,
      action: "complete",
      item: { ...exampleItem, status: "completed" },
    },
  }),
  task_uncomplete: defineToolReturn({
    schema: z.object({ ok: z.literal(true), action: z.string(), item: taskItemSchema }),
    example: { ok: true, action: "uncomplete", item: exampleItem },
  }),
  task_delete: defineToolReturn({
    schema: z.object({ ok: z.literal(true), action: z.literal("delete"), id: z.number() }),
    example: { ok: true, action: "delete", id: 10 },
  }),
  task_get: defineToolReturn({
    schema: z.object({ ok: z.literal(true), action: z.literal("get"), item: taskItemSchema }),
    example: { ok: true, action: "get", item: exampleItem },
  }),
  task_list: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("list"),
      count: z.number(),
      items: z.array(taskItemSchema),
    }),
    example: { ok: true, action: "list", count: 1, items: [exampleItem] },
  }),
  task_search: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("search"),
      count: z.number(),
      items: z.array(taskItemSchema),
    }),
    example: { ok: true, action: "search", count: 1, items: [exampleItem] },
  }),
  tasklist_list: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("list_lists"),
      count: z.number(),
      lists: z.array(taskListSchema),
    }),
    example: {
      ok: true,
      action: "list_lists",
      count: 1,
      lists: [exampleList],
    },
  }),
  tasklist_create: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("create_list"),
      list: taskListSchema,
    }),
    example: { ok: true, action: "create_list", list: exampleList },
  }),
  tasklist_update: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("update_list"),
      list: taskListSchema,
    }),
    example: {
      ok: true,
      action: "update_list",
      list: exampleList,
    },
  }),
  tasklist_delete: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("delete_list"),
      id: z.number(),
    }),
    example: { ok: true, action: "delete_list", id: 3 },
  }),
  tasklist_search: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("search_lists"),
      count: z.number(),
      lists: z.array(taskListSchema),
    }),
    example: { ok: true, action: "search_lists", count: 1, lists: [exampleList] },
  }),
};
