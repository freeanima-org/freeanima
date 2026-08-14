import { defineToolReturn, type ToolReturnContractFields, z } from "@freeanima/habitat/core/tool";

const semanticMemoryResultSchema = z.object({
  id: z.number().int().positive(),
  semantic_memory_id: z.number().int().positive(),
  type: z.string(),
  content: z.string(),
  pinned: z.boolean(),
  source_conversations: z.array(z.string()),
  observed_at: z.string().nullable(),
  occurred_at: z.string().nullable(),
  status: z.string(),
});

const rememberReturnSchema = z.object({
  ok: z.boolean(),
  action: z.string(),
  semantic_memory_id: z.number().int().positive(),
  fact_id: z.number().int().positive(),
});

export const MEMORY_TOOL_RETURNS: Record<string, ToolReturnContractFields> = {
  memory_semantic_create: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      id: z.number().int().positive(),
      semantic_memory_id: z.number().int().positive(),
      action: z.literal("create"),
    }),
    example: {
      ok: true,
      id: 1001,
      semantic_memory_id: 1001,
      action: "create",
    },
  }),
  memory_semantic_update: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      id: z.number().int().positive(),
      semantic_memory_id: z.number().int().positive(),
      action: z.literal("update"),
    }),
    example: {
      ok: true,
      id: 1001,
      semantic_memory_id: 1001,
      action: "update",
    },
  }),
  memory_semantic_deprecate: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      id: z.number().int().positive(),
      semantic_memory_id: z.number().int().positive(),
      action: z.literal("deprecate"),
    }),
    example: {
      ok: true,
      id: 1001,
      semantic_memory_id: 1001,
      action: "deprecate",
    },
  }),
  memory_semantic_search: defineToolReturn({
    schema: z.object({
      query: z.string().nullable(),
      count: z.number(),
      results: z.array(semanticMemoryResultSchema),
    }),
    example: {
      query: "preference",
      count: 1,
      results: [
        {
          id: 1001,
          semantic_memory_id: 1001,
          type: "preference",
          content: "Prefers concise reply style",
          pinned: false,
          source_conversations: ["sess-001"],
          observed_at: "2026-06-10T10:00:00+08:00",
          occurred_at: null,
          status: "active",
        },
      ],
    },
  }),
  memory_semantic_merge: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      id: z.string(),
      action: z.literal("merge"),
      deprecated_ids: z.array(z.string()),
      merged_source_conversations: z.array(z.string()),
      merged_observed_at: z.string().nullable(),
      merged_occurred_at: z.string().nullable(),
    }),
    example: {
      ok: true,
      id: "sm-merged",
      action: "merge",
      deprecated_ids: ["sm-001", "sm-002"],
      merged_source_conversations: ["sess-001"],
      merged_observed_at: "2026-06-01T10:00:00+08:00",
      merged_occurred_at: null,
    },
  }),
  memory_remember: defineToolReturn({
    schema: rememberReturnSchema,
    example: {
      ok: true,
      action: "create",
      semantic_memory_id: 1001,
      fact_id: 1001,
    },
  }),
};
