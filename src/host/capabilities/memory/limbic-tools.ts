import type { ToolDef } from "@freeanima/host/core/tool";
import { toolError, toolResult } from "@freeanima/host/core/tool";
import { omitUndefined } from "@freeanima/host/core/util";
import type {
  LimbicKind,
  LimbicMemoryCreateInput,
} from "@freeanima/host/core/db/pg/limbic-memory/types";
import { createLimbicMemory } from "@freeanima/host/core/db/pg/limbic-memory";

const LIMBIC_KINDS = ["conversation_mood", "turning_point", "spike"] as const;

function parseNumberArray(value: unknown): number[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return [];
  const out: number[] = [];
  for (const v of value) {
    const n = typeof v === "number" ? v : Number(String(v).trim());
    if (Number.isInteger(n) && n > 0) out.push(n);
  }
  return out;
}

function parseOptionalFloat(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value == null) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

export const limbicMemoryToolDefs: ToolDef[] = [
  {
    name: "memory_limbic_create",
    description:
      'Record limbic emotional memory (first person "I feel…"). kind: conversation_mood (session mood) | turning_point (emotional turn) | spike (intense moment). ' +
      "Use sparingly: mild swings, intensity < 0.3 should not be recorded; skip when no clear emotional signal.",
    parameters: {
      type: "object",
      properties: {
        conversation_id: { type: "string", description: "Associated conversation id" },
        kind: {
          type: "string",
          enum: [...LIMBIC_KINDS],
          description: "conversation_mood | turning_point | spike",
        },
        content: {
          type: "string",
          description: 'First-person emotional description, e.g. "I feel…"',
        },
        valence: { type: "number", description: "Valence -1.0 to 1.0 (negative to positive)" },
        arousal: { type: "number", description: "Arousal 0.0 to 1.0" },
        intensity: {
          type: "number",
          description: "Intensity 0.0 to 1.0, default 0.5; do not call if < 0.3",
        },
        source_segment: {
          type: "string",
          description: "Dialogue position: early | mid | late or specific segment",
        },
        semantic_memory_ids: {
          type: "array",
          items: { type: "number" },
          description: "Linked semantic_memory ids (often from phase 1 output)",
        },
      },
      required: ["conversation_id", "kind", "content"],
    },
    handler: async (args: Record<string, unknown>) => {
      const conversationId = String(args.conversation_id ?? "").trim();
      const content = String(args.content ?? "").trim();
      const kindRaw = String(args.kind ?? "").trim();

      if (!conversationId) return toolError("conversation_id is required");
      if (!content) return toolError("content is required");
      if (!LIMBIC_KINDS.includes(kindRaw as (typeof LIMBIC_KINDS)[number])) {
        return toolError(`kind must be one of: ${LIMBIC_KINDS.join(", ")}`);
      }

      const intensity = args.intensity !== undefined ? Number(args.intensity) : 0.5;
      if (Number.isNaN(intensity) || intensity < 0 || intensity > 1) {
        return toolError("intensity must be between 0 and 1");
      }
      if (intensity < 0.3) {
        return toolError(
          "intensity < 0.3: mild mood swings should not be written to limbic_memory",
        );
      }

      const row: LimbicMemoryCreateInput = omitUndefined({
        conversation_id: conversationId,
        kind: kindRaw as LimbicKind,
        content,
        valence: parseOptionalFloat(args.valence),
        arousal: parseOptionalFloat(args.arousal),
        intensity,
        source_segment: args.source_segment !== undefined ? String(args.source_segment) : undefined,
        semantic_memory_ids: parseNumberArray(args.semantic_memory_ids),
      });

      try {
        const id = await createLimbicMemory(row);
        return toolResult({ ok: true, id, kind: kindRaw, intensity });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  },
];
