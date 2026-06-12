import type { ToolDef } from "@freeanima/core/tool";
import { toolError, toolResult } from "@freeanima/core/tool";
import type {
  AutobiographicalSignificance,
  AutobiographicalMemoryCreateInput,
} from "@freeanima/core/repos";

import { getAutobiographicalMemoryStore } from "./autobiographical-port.ts";

const SIGNIFICANCE_VALUES = ["normal", "milestone", "turning_point"] as const;

function parseStringArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v).trim()).filter(Boolean);
}

function parseSourceSemanticMemory(args: Record<string, unknown>): string[] | undefined {
  const raw = args.source_semantic_memory ?? args.source_facts;
  return parseStringArray(raw);
}

export const autobiographicalMemoryToolDefs: ToolDef[] = [
  {
    name: "memory_autobiographical_create",
    description:
      "Create an autobiographical narrative (append-only; body immutable after write). Requires title and content; optional significance/period/source_semantic_memory/source_sessions.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Narrative title" },
        content: { type: "string", description: "Narrative body" },
        significance: {
          type: "string",
          enum: [...SIGNIFICANCE_VALUES],
          description: "normal | milestone | turning_point",
        },
        period_start: { type: "string", description: "Fuzzy period start" },
        period_end: { type: "string", description: "Fuzzy period end" },
        source_semantic_memory: {
          type: "array",
          items: { type: "string" },
          description: "Linked semantic_memory ids",
        },
        source_facts: {
          type: "array",
          items: { type: "string" },
          description: "Alias for source_semantic_memory",
        },
        source_sessions: {
          type: "array",
          items: { type: "string" },
          description: "Linked session ids",
        },
      },
      required: ["title", "content"],
    },
    handler: async (args: Record<string, unknown>) => {
      const title = String(args.title ?? "").trim();
      const content = String(args.content ?? "").trim();
      if (!title) return toolError("title is required");
      if (!content) return toolError("content is required");

      const sigRaw = args.significance !== undefined ? String(args.significance).trim() : undefined;
      const significance =
        sigRaw && SIGNIFICANCE_VALUES.includes(sigRaw as (typeof SIGNIFICANCE_VALUES)[number])
          ? (sigRaw as AutobiographicalSignificance)
          : undefined;

      const row: AutobiographicalMemoryCreateInput = {
        title,
        content,
        significance,
        period_start: args.period_start !== undefined ? String(args.period_start) : undefined,
        period_end: args.period_end !== undefined ? String(args.period_end) : undefined,
        source_semantic_memory: parseSourceSemanticMemory(args),
        source_sessions: parseStringArray(args.source_sessions),
      };

      try {
        const id = await getAutobiographicalMemoryStore().create(row);
        return toolResult({ ok: true, id, title });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  },
  {
    name: "memory_autobiographical_deprecate",
    description:
      "Soft-deprecate an autobiographical narrative (body unchanged, status=deprecated).",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "autobiographical_memory id" },
      },
      required: ["id"],
    },
    handler: async (args: Record<string, unknown>) => {
      const id = String(args.id ?? "").trim();
      if (!id) return toolError("id is required");
      try {
        const ok = await getAutobiographicalMemoryStore().deprecate(id);
        return toolResult({ ok, id });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  },
];
