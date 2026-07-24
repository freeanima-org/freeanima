import { defineToolReturn, type ToolReturnContractFields, z } from "@freeanima/host/core/tool";
import { clarifyItemSchema } from "@freeanima/host/core/db/schema";

export const CLARIFY_TOOL_RETURNS: Record<string, ToolReturnContractFields> = {
  clarify: defineToolReturn({
    schema: z.discriminatedUnion("status", [
      z.object({
        status: z.literal("awaiting"),
        items: z.array(clarifyItemSchema),
        timeout_sec: z.number(),
      }),
      z.object({
        status: z.literal("resolved"),
        answers: z.array(z.object({ question: z.string(), answer: z.string() })),
      }),
    ]),
    example: {
      status: "awaiting",
      items: [{ question: "Which approach would you prefer?", choices: ["A", "B"] }],
      timeout_sec: 300,
    },
  }),
};
