import { defineToolReturn, type ToolReturnContractFields, z } from "@freeanima/habitat/core/tool";

const diaryTextBlockSchema = z.object({
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

const diaryEntrySchema = z.object({
  id: z.number(),
  title: z.string(),
  summary: z.string(),
  entry_at: z.string(),
  tag_ids: z.array(z.number()),
  blocks: z.array(diaryTextBlockSchema),
  created_at: z.string(),
  updated_at: z.string(),
});

const exampleBlock = {
  id: 101,
  title: "",
  content: "第一段",
  sort_order: 0,
  parent_id: 42,
  client_op_id: null,
  components: ["content_block"],
  tag_ids: [] as number[],
  created_at: "2026-06-29T20:00:00+08:00",
  updated_at: "2026-06-29T20:00:00+08:00",
};

const exampleEntry = {
  id: 42,
  title: "今日记录",
  summary: "",
  entry_at: "2026-06-29T20:00:00+08:00",
  tag_ids: [7],
  blocks: [exampleBlock, { ...exampleBlock, id: 102, content: "第二段", sort_order: 1 }],
  created_at: "2026-06-29T20:00:00+08:00",
  updated_at: "2026-06-29T21:00:00+08:00",
};

const exampleEntryMeta = {
  ...exampleEntry,
  blocks: [] as typeof exampleEntry.blocks,
};

const exampleSearchHitBlock = {
  id: 101,
  title: "情绪",
  content: "感到紧张但可控…",
  sort_order: 0,
  parent_id: 42,
  client_op_id: null,
  components: ["content_block", "limbic"],
  tag_ids: [] as number[],
  created_at: "2026-06-29T20:00:00+08:00",
  updated_at: "2026-06-29T20:00:00+08:00",
};

const exampleSearchEntry = {
  ...exampleEntryMeta,
  blocks: [exampleSearchHitBlock],
};

export const DIARY_TOOL_RETURNS: Record<string, ToolReturnContractFields> = {
  diary_append: defineToolReturn({
    schema: z.object({ ok: z.literal(true), action: z.literal("append"), item: diaryEntrySchema }),
    example: { ok: true, action: "append", item: exampleEntry },
  }),
  diary_update: defineToolReturn({
    schema: z.object({ ok: z.literal(true), action: z.string(), item: diaryEntrySchema }),
    example: { ok: true, action: "update", item: exampleEntry },
  }),
  diary_delete: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("delete"),
      date: z.string(),
    }),
    example: { ok: true, action: "delete", date: "2026-06-29" },
  }),
  diary_get: defineToolReturn({
    schema: z.object({ ok: z.literal(true), action: z.literal("get"), item: diaryEntrySchema }),
    example: { ok: true, action: "get", item: exampleEntry },
  }),
  diary_list: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("list"),
      count: z.number(),
      items: z.array(diaryEntrySchema),
    }),
    example: { ok: true, action: "list", count: 1, items: [exampleEntryMeta] },
  }),
  diary_search: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("search"),
      count: z.number(),
      items: z.array(diaryEntrySchema),
    }),
    example: { ok: true, action: "search", count: 1, items: [exampleSearchEntry] },
  }),
};
