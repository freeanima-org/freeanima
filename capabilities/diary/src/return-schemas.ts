import { defineToolReturn, type ToolReturnContractFields, z } from "@freeanima/core/tool";

const diaryEntrySchema = z.object({
  id: z.number(),
  title: z.string(),
  summary: z.string(),
  content: z.string(),
  entry_at: z.string(),
  tags: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
});

const exampleEntry = {
  id: 42,
  title: "今日记录",
  summary: "",
  content: "第一段\n\n第二段",
  entry_at: "2026-06-29T20:00:00+08:00",
  tags: ["日常"],
  created_at: "2026-06-29T20:00:00+08:00",
  updated_at: "2026-06-29T21:00:00+08:00",
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
    example: { ok: true, action: "list", count: 1, items: [exampleEntry] },
  }),
  diary_search: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("search"),
      count: z.number(),
      items: z.array(diaryEntrySchema),
    }),
    example: { ok: true, action: "search", count: 1, items: [exampleEntry] },
  }),
};
