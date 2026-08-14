import { defineToolReturn, type ToolReturnContractFields, z } from "@freeanima/habitat/core/tool";

const noteTextBlockSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  sort_order: z.number(),
  parent_id: z.number(),
  client_op_id: z.string().nullable(),
  components: z.array(z.string()),
  tag_ids: z.array(z.number()),
  created_at: z.string(),
  updated_at: z.string(),
});

const noteSchema = z.object({
  id: z.number(),
  title: z.string(),
  summary: z.string(),
  tag_ids: z.array(z.number()),
  blocks: z.array(noteTextBlockSchema),
  created_at: z.string(),
  updated_at: z.string(),
});

const exampleBlock = {
  id: 201,
  title: "",
  content: "第一段 Markdown",
  sort_order: 0,
  parent_id: 88,
  client_op_id: null,
  components: ["content_block"],
  tag_ids: [] as number[],
  created_at: "2026-08-14T12:00:00+08:00",
  updated_at: "2026-08-14T12:00:00+08:00",
};

const exampleNote = {
  id: 88,
  title: "主题笔记",
  summary: "",
  tag_ids: [3],
  blocks: [exampleBlock],
  created_at: "2026-08-14T12:00:00+08:00",
  updated_at: "2026-08-14T13:00:00+08:00",
};

const exampleNoteMeta = {
  ...exampleNote,
  blocks: [] as typeof exampleNote.blocks,
};

export const NOTE_TOOL_RETURNS: Record<string, ToolReturnContractFields> = {
  note_create: defineToolReturn({
    schema: z.object({ ok: z.literal(true), action: z.literal("create"), item: noteSchema }),
    example: { ok: true, action: "create", item: exampleNote },
  }),
  note_update: defineToolReturn({
    schema: z.object({ ok: z.literal(true), action: z.literal("update"), item: noteSchema }),
    example: { ok: true, action: "update", item: exampleNote },
  }),
  note_delete: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("delete"),
      id: z.number(),
    }),
    example: { ok: true, action: "delete", id: 88 },
  }),
  note_get: defineToolReturn({
    schema: z.object({ ok: z.literal(true), action: z.literal("get"), item: noteSchema }),
    example: { ok: true, action: "get", item: exampleNote },
  }),
  note_list: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("list"),
      count: z.number(),
      items: z.array(noteSchema),
    }),
    example: { ok: true, action: "list", count: 1, items: [exampleNoteMeta] },
  }),
  note_search: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("search"),
      count: z.number(),
      items: z.array(noteSchema),
    }),
    example: { ok: true, action: "search", count: 1, items: [exampleNote] },
  }),
};
