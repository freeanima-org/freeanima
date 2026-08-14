import type { ToolDef } from "@freeanima/habitat/core/tool";
import { toolError, toolResult } from "@freeanima/habitat/core/tool";
import {
  buildTextSearchSnippet,
  formatFtsToolError,
  isFtsQueryError,
  omitUndefined,
} from "@freeanima/habitat/core/util";
import type {
  AutobiographicalSignificance,
  AutobiographicalMemoryCreateInput,
} from "@freeanima/habitat/core/db/pg/autobiographical-memory/types";

import { coerceString } from "@freeanima/shared/coerce-string";
import {
  createAutobiographicalMemory,
  deprecateAutobiographicalMemory,
  searchAutobiographicalMemoryFts,
} from "@freeanima/habitat/core/db/pg/autobiographical-memory";

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
    name: "memory_autobiographical_search",
    description:
      "Full-text search autobiographical narratives (title + body). Returns active narratives with title and content snippet. " +
      "Use when you need life-story / milestone recall; not for facts (memory_semantic_search) or raw dialogue (conversation_search).",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Full-text keywords (required)",
        },
        limit: {
          type: "number",
          description: "Max results, default 10, cap 30",
        },
      },
      required: ["query"],
    },
    handler: async (args: Record<string, unknown>) => {
      const query = coerceString(args.query ?? "").trim();
      if (!query) return toolError("query is required");
      const limit = Math.max(1, Math.min(30, args.limit !== undefined ? Number(args.limit) : 10));
      try {
        const rows = await searchAutobiographicalMemoryFts(query, { limit });
        return toolResult({
          query,
          count: rows.length,
          results: rows.map((r) => ({
            autobiographical_memory_id: r.id,
            title: r.title,
            snippet: buildTextSearchSnippet(query, r.content),
            significance: r.significance,
            status: r.status,
            period_start: r.period_start,
            period_end: r.period_end,
            score: r.rank,
          })),
        });
      } catch (err) {
        if (isFtsQueryError(err)) return toolError(formatFtsToolError(err));
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  },
  {
    name: "memory_autobiographical_create",
    description:
      "Create an autobiographical narrative (append-only; body immutable after write). Requires title and content; optional significance/period/source_semantic_memory/source_conversations.",
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
          description: "Linked semantic_memory ids (alias: source_facts)",
        },
        source_conversations: {
          type: "array",
          items: { type: "string" },
          description: "Linked conversation ids",
        },
      },
      required: ["title", "content"],
    },
    handler: async (args: Record<string, unknown>) => {
      const title = coerceString(args.title ?? "").trim();
      const content = coerceString(args.content ?? "").trim();
      if (!title) return toolError("title is required");
      if (!content) return toolError("content is required");

      const sigRaw =
        args.significance !== undefined ? coerceString(args.significance).trim() : undefined;
      const significance =
        sigRaw && SIGNIFICANCE_VALUES.includes(sigRaw as (typeof SIGNIFICANCE_VALUES)[number])
          ? (sigRaw as AutobiographicalSignificance)
          : undefined;

      const row: AutobiographicalMemoryCreateInput = omitUndefined({
        title,
        content,
        significance,
        period_start: args.period_start !== undefined ? coerceString(args.period_start) : undefined,
        period_end: args.period_end !== undefined ? coerceString(args.period_end) : undefined,
        source_semantic_memory: parseSourceSemanticMemory(args),
        source_conversations: parseStringArray(args.source_conversations),
      });

      try {
        const id = await createAutobiographicalMemory(row);
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
      const id = coerceString(args.id ?? "").trim();
      if (!id) return toolError("id is required");
      try {
        const ok = await deprecateAutobiographicalMemory(id);
        return toolResult({ ok, id });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  },
];
