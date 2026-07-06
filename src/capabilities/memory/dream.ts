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

import { getDreamEntryByDay, getLatestDreamEntry } from "./dream/entry-store.ts";
import { resolveDreamWorldId } from "./dream/subject-world.ts";

const dreamReadReturnSchema = z.object({
  ok: z.literal(true),
  dream_day: z.string(),
  dream_id: z.number().int().positive(),
  content: z.string(),
  source_limbic_ids: z.array(z.string()),
  source_conversation_ids: z.array(z.string()),
  legacy_id: z.string().optional(),
});

const DREAM_TOOL_RETURNS: Record<string, ToolReturnContractFields> = {
  dream_read: defineToolReturn({
    schema: dreamReadReturnSchema,
    example: {
      ok: true,
      dream_day: "2026-06-14",
      dream_id: 42,
      content: "我在一条没有尽头的走廊里…",
      source_limbic_ids: ["limbic-1"],
      source_conversation_ids: ["sess-1"],
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
            "Read a stored dream narrative. Defaults to the latest dream when day is omitted.",
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
            const worldId = await resolveDreamWorldId();
            const ctx = { worldId };
            const dayArg = String(args.day ?? "").trim();
            const row = dayArg
              ? await getDreamEntryByDay(ctx, dayArg)
              : await getLatestDreamEntry(ctx);
            if (!row) {
              return toolError(dayArg ? `No dream found for ${dayArg}` : "No dream found");
            }

            return toolResult({
              ok: true as const,
              dream_day: row.dream_day,
              dream_id: row.id,
              content: row.content,
              source_limbic_ids: row.source_limbic_ids,
              source_conversation_ids: row.source_conversation_ids,
              ...(row.legacy_id !== undefined ? { legacy_id: row.legacy_id } : {}),
            });
          },
        },
      ],
      DREAM_TOOL_RETURNS,
    ),
  );
}
