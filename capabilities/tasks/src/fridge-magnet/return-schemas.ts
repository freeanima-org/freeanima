import { defineToolReturn, type ToolReturnContractFields, z } from "@freeanima/core/tool";

export const FRIDGE_TOOL_RETURNS: Record<string, ToolReturnContractFields> = {
  fridge_magnet_write: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      redis_key: z.string(),
      label: z.string(),
      ttl: z.number(),
    }),
    example: {
      ok: true,
      redis_key: "fridge-magnet:session:sess-001:mood",
      label: "mood",
      ttl: 86400,
    },
  }),
};
