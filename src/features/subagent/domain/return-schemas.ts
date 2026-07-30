import { defineToolReturn, type ToolReturnContractFields, z } from "@freeanima/host/core/tool";

const subagentRowSchema = z.object({
  id: z.number(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  content: z.string(),
  skills: z.array(z.string()),
  max_turns: z.number().nullable(),
  allowed_tools: z.array(z.string()),
  denied_tools: z.array(z.string()),
  prompt_includes: z.array(z.enum(["self", "world", "time"])),
  world_id: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

const exampleRow = {
  id: 1,
  slug: "explorer",
  title: "Explorer",
  summary: "Read-only explore",
  content: "",
  skills: [],
  max_turns: 20,
  allowed_tools: ["@memory"],
  denied_tools: [],
  prompt_includes: [] as Array<"self" | "world" | "time">,
  world_id: 1,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const runResultSchema = z.object({
  run_id: z.string(),
  slug: z.string(),
  subagent_entity_id: z.number(),
  status: z.enum(["ok", "error"]),
  output: z.string(),
  tool_calls: z.number(),
  error: z.string().optional(),
  duration_ms: z.number(),
});

export const SUBAGENT_TOOL_RETURNS: Record<string, ToolReturnContractFields> = {
  subagent_list: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("list"),
      count: z.number(),
      items: z.array(subagentRowSchema),
    }),
    example: { ok: true, action: "list", count: 1, items: [exampleRow] },
  }),
  subagent_get: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("get"),
      item: subagentRowSchema,
    }),
    example: { ok: true, action: "get", item: exampleRow },
  }),
  subagent_create: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("create"),
      item: subagentRowSchema,
    }),
    example: { ok: true, action: "create", item: exampleRow },
  }),
  subagent_update: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("update"),
      item: subagentRowSchema,
    }),
    example: { ok: true, action: "update", item: exampleRow },
  }),
  subagent_delete: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("delete"),
      id: z.number(),
    }),
    example: { ok: true, action: "delete", id: 1 },
  }),
  subagent_run: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      action: z.literal("run"),
      count: z.number(),
      results: z.array(runResultSchema),
    }),
    example: {
      ok: true,
      action: "run",
      count: 1,
      results: [
        {
          run_id: "alr_1",
          slug: "explorer",
          subagent_entity_id: 1,
          status: "ok",
          output: "done",
          tool_calls: 2,
          duration_ms: 100,
        },
      ],
    },
  }),
};
