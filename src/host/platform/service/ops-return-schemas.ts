import { defineToolReturn, type ToolReturnContractFields, z } from "@freeanima/host/core/tool";

const healthSchema = z.object({
  status: z.literal("ok"),
  version: z.string(),
  build: z.record(z.string(), z.unknown()).optional(),
  started_at: z.string().optional(),
});

export const OPS_TOOL_RETURNS: Record<string, ToolReturnContractFields> = {
  ops_health: defineToolReturn({
    schema: healthSchema,
    example: {
      status: "ok",
      version: "0.9.4",
      started_at: "2026-07-25T12:00:00+08:00",
    },
  }),
  ops_status: defineToolReturn({
    schema: z.record(z.string(), z.unknown()),
    example: {
      status: "running",
      pid: 1234,
      version: "0.9.4",
      uptime_seconds: 3600,
    },
  }),
  ops_config_get: defineToolReturn({
    schema: z.object({
      config: z.record(z.string(), z.unknown()),
      section: z.string().optional(),
    }),
    example: {
      config: { llm: { default_profile: "chat" } },
    },
  }),
  ops_config_patch: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      section: z.string(),
      config: z.record(z.string(), z.unknown()),
    }),
    example: {
      ok: true,
      section: "browser",
      config: { browser: { camofox: { timeout_ms: 30000 } } },
    },
  }),
  ops_restart: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      code: z.literal("service_restarting"),
    }),
    example: { ok: true, code: "service_restarting" },
  }),
};
