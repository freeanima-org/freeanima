import { defineToolReturn, type ToolReturnContractFields, z } from "@freeanima/core/tool";

const semanticMemoryResultSchema = z.object({
  id: z.string(),
  semantic_memory_id: z.string(),
  type: z.string(),
  content: z.string(),
  pinned: z.boolean(),
  source_sessions: z.array(z.string()),
  observed_at: z.string().nullable(),
  occurred_at: z.string().nullable(),
  status: z.string(),
});

const memoryRecallHitSchema = z.discriminatedUnion("memory_type", [
  z.object({
    memory_type: z.literal("semantic"),
    score: z.number(),
    semantic_memory_id: z.string(),
    type: z.string(),
    pinned: z.boolean(),
    content: z.string(),
    source_sessions: z.array(z.string()),
    observed_at: z.string().nullable(),
    occurred_at: z.string().nullable(),
    status: z.string(),
  }),
  z.object({
    memory_type: z.literal("session"),
    score: z.number(),
    session_id: z.string(),
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
    session_id: z.string(),
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
  semantic_memory_id: z.string(),
  fact_id: z.string(),
});

export const MEMORY_TOOL_RETURNS: Record<string, ToolReturnContractFields> = {
  memory_semantic_create: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      id: z.string(),
      semantic_memory_id: z.string(),
      action: z.literal("create"),
    }),
    example: {
      ok: true,
      id: "sm-001",
      semantic_memory_id: "sm-001",
      action: "create",
    },
  }),
  memory_semantic_update: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      id: z.string(),
      semantic_memory_id: z.string(),
      action: z.literal("update"),
    }),
    example: {
      ok: true,
      id: "sm-001",
      semantic_memory_id: "sm-001",
      action: "update",
    },
  }),
  memory_semantic_deprecate: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      id: z.string(),
      semantic_memory_id: z.string(),
      action: z.literal("deprecate"),
    }),
    example: {
      ok: true,
      id: "sm-001",
      semantic_memory_id: "sm-001",
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
          id: "sm-001",
          semantic_memory_id: "sm-001",
          type: "preference",
          content: "Prefers concise reply style",
          pinned: false,
          source_sessions: ["sess-001"],
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
      merged_source_sessions: z.array(z.string()),
      merged_observed_at: z.string().nullable(),
      merged_occurred_at: z.string().nullable(),
    }),
    example: {
      ok: true,
      id: "sm-merged",
      action: "merge",
      deprecated_ids: ["sm-001", "sm-002"],
      merged_source_sessions: ["sess-001"],
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
      kind: z.enum(["session_mood", "turning_point", "spike"]),
      intensity: z.number(),
    }),
    example: { ok: true, id: "lm-001", kind: "session_mood", intensity: 0.6 },
  }),
  memory_remember: defineToolReturn({
    schema: rememberReturnSchema,
    example: {
      ok: true,
      action: "create",
      semantic_memory_id: "sm-001",
      fact_id: "sm-001",
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
          semantic_memory_id: "sm-001",
          type: "observation",
          pinned: false,
          content: "Conversation compression strategy prefers concise summaries",
          source_sessions: ["sess-001"],
          observed_at: "2026-06-10T10:00:00+08:00",
          occurred_at: null,
          status: "active",
        },
      ],
      summary: "Found 1 related memory",
    },
  }),
};
