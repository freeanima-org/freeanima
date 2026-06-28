import type { ToolSetRegistry } from "@freeanima/core/tool";
import {
  attachToolReturns,
  defineToolReturn,
  toolError,
  toolResult,
  type ToolArgs,
  type ToolReturnContractFields,
  z,
} from "@freeanima/core/tool";

import { getDreamFridge } from "./dream-fridge-port.ts";
import { getDreamMemoryByDay, getLatestDreamMemory } from "@freeanima/core/db/pg/dream-memory";
import { dismissDreamReminder } from "./dream/run.ts";

const dreamReadReturnSchema = z.object({
  ok: z.literal(true),
  dream_day: z.string(),
  dream_id: z.string(),
  content: z.string(),
  source_limbic_ids: z.array(z.string()),
  source_conversation_ids: z.array(z.string()),
  reminder_dismissed: z.boolean(),
});

const DREAM_TOOL_RETURNS: Record<string, ToolReturnContractFields> = {
  dream_read: defineToolReturn({
    schema: dreamReadReturnSchema,
    example: {
      ok: true,
      dream_day: "2026-06-14",
      dream_id: "dream-001",
      content: "我在一条没有尽头的走廊里…",
      source_limbic_ids: ["limbic-1"],
      source_conversation_ids: ["sess-1"],
      reminder_dismissed: true,
    },
  }),
};

export function registerDreamTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "dream",
    "Dream memory read",
    attachToolReturns(
      [
        {
          name: "dream_read",
          description:
            "Read a stored dream narrative. Defaults to the latest dream when day is omitted. Automatically dismisses the dream fridge magnet reminder for that day after reading.",
          parameters: {
            type: "object",
            properties: {
              day: {
                type: "string",
                description: "CST calendar day YYYY-MM-DD; omit for latest dream",
              },
            },
            required: [],
          },
          handler: async (args: ToolArgs) => {
            const dayArg = String(args.day ?? "").trim();
            const row = dayArg ? await getDreamMemoryByDay(dayArg) : await getLatestDreamMemory();
            if (!row) {
              return toolError(dayArg ? `No dream found for ${dayArg}` : "No dream found");
            }

            const fridge = getDreamFridge();
            await dismissDreamReminder(fridge ?? undefined, row.dream_day);

            return toolResult({
              ok: true as const,
              dream_day: row.dream_day,
              dream_id: row.id,
              content: row.content,
              source_limbic_ids: row.source_limbic_ids,
              source_conversation_ids: row.source_conversation_ids,
              reminder_dismissed: Boolean(fridge),
            });
          },
        },
      ],
      DREAM_TOOL_RETURNS,
    ),
  );
}
