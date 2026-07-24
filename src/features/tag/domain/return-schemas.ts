import { defineToolReturn, type ToolReturnContractFields, z } from "@freeanima/host/core/tool";

const tagRowSchema = z.object({
  id: z.number(),
  title: z.string(),
  sort_order: z.number(),
});

const exampleTag = {
  id: 1,
  title: "优化",
  sort_order: 0,
};

export const TAG_TOOL_RETURNS: Record<string, ToolReturnContractFields> = {
  tag_list: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("list"),
      count: z.number(),
      tags: z.array(tagRowSchema),
    }),
    example: { ok: true, action: "list", count: 1, tags: [exampleTag] },
  }),
  tag_search: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("search"),
      count: z.number(),
      tags: z.array(tagRowSchema),
    }),
    example: { ok: true, action: "search", count: 1, tags: [exampleTag] },
  }),
  tag_create: defineToolReturn({
    schema: z.object({ ok: z.literal(true), action: z.literal("create"), item: tagRowSchema }),
    example: { ok: true, action: "create", item: exampleTag },
  }),
  tag_update: defineToolReturn({
    schema: z.object({ ok: z.literal(true), action: z.literal("update"), item: tagRowSchema }),
    example: { ok: true, action: "update", item: exampleTag },
  }),
  tag_delete: defineToolReturn({
    schema: z.object({ ok: z.literal(true), action: z.literal("delete"), id: z.number() }),
    example: { ok: true, action: "delete", id: 1 },
  }),
  tag_set_on_entity: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("set_on_entity"),
      entity_id: z.number(),
      tag_ids: z.array(z.number()),
    }),
    example: { ok: true, action: "set_on_entity", entity_id: 10, tag_ids: [1] },
  }),
};
