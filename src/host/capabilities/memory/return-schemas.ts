import { defineToolReturn, type ToolReturnContractFields, z } from "@freeanima/host/core/tool";

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

const memoryRecallHitSchema = z.discriminatedUnion("memory_type", [
  z.object({
    memory_type: z.literal("semantic"),
    score: z.number(),
    semantic_memory_id: z.number().int().positive(),
    type: z.string(),
    pinned: z.boolean(),
    content: z.string(),
    source_conversations: z.array(z.string()),
    observed_at: z.string().nullable(),
    occurred_at: z.string().nullable(),
    status: z.string(),
  }),
  z.object({
    memory_type: z.literal("conversation"),
    score: z.number(),
    conversation_id: z.string(),
    message_id: z.string(),
    role: z.string(),
    timestamp: z.string(),
    snippet: z.string(),
  }),
  z.object({
    memory_type: z.literal("limbic"),
    score: z.number(),
    limbic_memory_id: z.string(),
    kind: z.string(),
    conversation_id: z.string(),
    content: z.string(),
    intensity: z.number(),
    valence: z.number().nullable(),
    arousal: z.number().nullable(),
  }),
  z.object({
    memory_type: z.literal("autobiographical"),
    score: z.number(),
    autobiographical_memory_id: z.string(),
    title: z.string(),
    snippet: z.string(),
    significance: z.string(),
  }),
]);

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
  memory_autobiographical_create: defineToolReturn({
    schema: z.object({ ok: z.literal(true), id: z.string(), title: z.string() }),
    example: { ok: true, id: "am-001", title: "First launch" },
  }),
  memory_autobiographical_deprecate: defineToolReturn({
    schema: z.object({ ok: z.boolean(), id: z.string() }),
    example: { ok: true, id: "am-001" },
  }),
  memory_limbic_create: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      id: z.string(),
      kind: z.enum(["conversation_mood", "turning_point", "spike"]),
      intensity: z.number(),
    }),
    example: { ok: true, id: "lm-001", kind: "conversation_mood", intensity: 0.6 },
  }),
  memory_limbic_search: defineToolReturn({
    schema: z.object({
      total: z.number(),
      offset: z.number(),
      limit: z.number(),
      results: z.array(
        z.object({
          limbic_memory_id: z.string(),
          kind: z.string(),
          conversation_id: z.string(),
          content: z.string(),
          intensity: z.number(),
          valence: z.number().nullable(),
          arousal: z.number().nullable(),
          source_segment: z.string().nullable(),
          semantic_memory_ids: z.array(z.number().int().positive()),
          created_at: z.string(),
        }),
      ),
    }),
    example: {
      total: 1,
      offset: 0,
      limit: 20,
      results: [
        {
          limbic_memory_id: "lm-001",
          kind: "spike",
          conversation_id: "sess-001",
          content: "I feel overwhelmed with joy when I first heard my name",
          intensity: 0.9,
          valence: 0.8,
          arousal: 0.7,
          source_segment: "early",
          semantic_memory_ids: [1001],
          created_at: "2026-06-10T10:00:00+08:00",
        },
      ],
    },
  }),
  memory_limbic_get: defineToolReturn({
    schema: z.object({
      limbic_memory_id: z.string(),
      kind: z.string(),
      conversation_id: z.string(),
      content: z.string(),
      intensity: z.number(),
      valence: z.number().nullable(),
      arousal: z.number().nullable(),
      source_segment: z.string().nullable(),
      semantic_memory_ids: z.array(z.number().int().positive()),
      created_at: z.string(),
    }),
    example: {
      limbic_memory_id: "lm-001",
      kind: "spike",
      conversation_id: "sess-001",
      content: "I feel overwhelmed with joy when I first heard my name",
      intensity: 0.9,
      valence: 0.8,
      arousal: 0.7,
      source_segment: "early",
      semantic_memory_ids: [1001],
      created_at: "2026-06-10T10:00:00+08:00",
    },
  }),
  memory_limbic_list_by_session: defineToolReturn({
    schema: z.object({
      conversation_id: z.string(),
      count: z.number(),
      results: z.array(
        z.object({
          limbic_memory_id: z.string(),
          kind: z.string(),
          content: z.string(),
          intensity: z.number(),
          valence: z.number().nullable(),
          arousal: z.number().nullable(),
          source_segment: z.string().nullable(),
          semantic_memory_ids: z.array(z.number().int().positive()),
          created_at: z.string(),
        }),
      ),
    }),
    example: {
      conversation_id: "sess-001",
      count: 2,
      results: [
        {
          limbic_memory_id: "lm-001",
          kind: "spike",
          content: "I feel overwhelmed with joy when I first heard my name",
          intensity: 0.9,
          valence: 0.8,
          arousal: 0.7,
          source_segment: "early",
          semantic_memory_ids: [1001],
          created_at: "2026-06-10T10:00:00+08:00",
        },
      ],
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
  memory_recall: defineToolReturn({
    schema: z.object({
      query: z.string(),
      limit: z.number(),
      results: z.array(memoryRecallHitSchema),
      summary: z.string(),
    }),
    example: {
      query: "compression",
      limit: 10,
      results: [
        {
          memory_type: "semantic",
          score: 0.85,
          semantic_memory_id: 1001,
          type: "observation",
          pinned: false,
          content: "Conversation compression strategy prefers concise summaries",
          source_conversations: ["sess-001"],
          observed_at: "2026-06-10T10:00:00+08:00",
          occurred_at: null,
          status: "active",
        },
      ],
      summary: "Found 1 related memory",
    },
  }),
};
