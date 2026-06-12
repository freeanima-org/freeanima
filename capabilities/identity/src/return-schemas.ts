import { defineToolReturn, type ToolReturnContractFields, z } from "@freeanima/core/tool";
import { SELF_BLOCK_KEYS } from "@freeanima/core/repos";

const selfBlockSchema = z.object({
  block_key: z.enum(SELF_BLOCK_KEYS),
  content: z.string(),
  locked: z.boolean().optional(),
  updated_at: z.string().optional(),
  updated_by: z.string().optional(),
});

export const SELF_TOOL_RETURNS: Record<string, ToolReturnContractFields> = {
  self_get_blocks: defineToolReturn({
    schema: z.object({ blocks: z.array(selfBlockSchema) }),
    example: {
      blocks: [
        {
          block_key: "self_model",
          content: "## Self model\n\nI am FreeAnima.",
          locked: false,
          updated_at: "2026-06-10T10:00:00+08:00",
          updated_by: "tool",
        },
      ],
    },
  }),
  self_update_block: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      block_key: z.enum(SELF_BLOCK_KEYS),
    }),
    example: { ok: true, block_key: "self_model" },
  }),
};
