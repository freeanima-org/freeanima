import { defineToolReturn, type ToolReturnContractFields, z } from "@freeanima/core/tool";

const limbicSchema = z
  .object({
    valence: z.number(),
    arousal: z.number(),
    intensity: z.number(),
  })
  .nullable();

const narrativeSchema = z
  .object({
    significance: z.enum(["normal", "milestone", "turning_point"]).optional(),
  })
  .nullable();

const semanticRefSchema = z
  .object({
    semantic_memory_id: z.string(),
  })
  .nullable();

const contentBlockSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  summary: z.string(),
  block_type: z.enum(["text", "image", "audio", "video", "link_card", "file"]),
  parent_id: z.number(),
  sort_order: z.number(),
  url: z.string().nullable(),
  client_op_id: z.string().nullable(),
  components: z.array(z.string()),
  limbic: limbicSchema,
  narrative: narrativeSchema,
  semantic_ref: semanticRefSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

const exampleBlock = {
  id: 101,
  title: "",
  content: "今天心情不错",
  summary: "",
  block_type: "text" as const,
  parent_id: 42,
  sort_order: 0,
  url: null,
  client_op_id: null,
  components: ["content_block", "limbic"],
  limbic: { valence: 0.4, arousal: 0.3, intensity: 0.5 },
  narrative: null,
  semantic_ref: null,
  created_at: "2026-07-17T10:00:00+08:00",
  updated_at: "2026-07-17T10:00:00+08:00",
};

export const CONTENT_BLOCK_TOOL_RETURNS: Record<string, ToolReturnContractFields> = {
  content_block_create: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("create"),
      item: contentBlockSchema,
    }),
    example: { ok: true, action: "create", item: exampleBlock },
  }),
  content_block_update: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("update"),
      item: contentBlockSchema,
    }),
    example: { ok: true, action: "update", item: exampleBlock },
  }),
  content_block_delete: defineToolReturn({
    schema: z.object({ ok: z.literal(true), action: z.literal("delete"), id: z.number() }),
    example: { ok: true, action: "delete", id: 101 },
  }),
  content_block_get: defineToolReturn({
    schema: z.object({ ok: z.literal(true), action: z.literal("get"), item: contentBlockSchema }),
    example: { ok: true, action: "get", item: exampleBlock },
  }),
  content_block_list: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("list"),
      count: z.number(),
      items: z.array(contentBlockSchema),
    }),
    example: { ok: true, action: "list", count: 1, items: [exampleBlock] },
  }),
  content_block_search: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("search"),
      count: z.number(),
      items: z.array(contentBlockSchema),
    }),
    example: { ok: true, action: "search", count: 1, items: [exampleBlock] },
  }),
  content_block_reorder: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("reorder"),
      count: z.number(),
      items: z.array(contentBlockSchema),
    }),
    example: { ok: true, action: "reorder", count: 1, items: [exampleBlock] },
  }),
};
