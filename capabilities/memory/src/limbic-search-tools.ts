import type { ToolDef } from "@freeanima/core/tool";
import { toolError, toolResult } from "@freeanima/core/tool";
import type { LimbicKind, LimbicMemoryRow } from "@freeanima/core/repos";
import {
  getLimbicMemory,
  listLimbicMemory,
  listLimbicMemoryBySession,
} from "@freeanima/core/db/pg/limbic-memory";

const LIMBIC_KINDS = ["conversation_mood", "turning_point", "spike"] as const;

function parseOptionalFloat(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function clampRange(
  rows: LimbicMemoryRow[],
  opts: {
    minIntensity?: number | null;
    maxIntensity?: number | null;
    minValence?: number | null;
    maxValence?: number | null;
  },
): LimbicMemoryRow[] {
  let out = rows;
  if (opts.minIntensity != null) {
    out = out.filter((r) => r.intensity >= opts.minIntensity!);
  }
  if (opts.maxIntensity != null) {
    out = out.filter((r) => r.intensity <= opts.maxIntensity!);
  }
  if (opts.minValence != null) {
    out = out.filter((r) => r.valence != null && r.valence >= opts.minValence!);
  }
  if (opts.maxValence != null) {
    out = out.filter((r) => r.valence != null && r.valence <= opts.maxValence!);
  }
  return out;
}

function applyOrder(rows: LimbicMemoryRow[], orderBy: string | undefined): LimbicMemoryRow[] {
  const order = orderBy ?? "created_desc";
  switch (order) {
    case "intensity_desc":
      return [...rows].toSorted((a, b) => b.intensity - a.intensity);
    case "intensity_asc":
      return [...rows].toSorted((a, b) => a.intensity - b.intensity);
    case "valence_desc":
      return [...rows].toSorted((a, b) => (b.valence ?? 0) - (a.valence ?? 0));
    case "valence_asc":
      return [...rows].toSorted((a, b) => (a.valence ?? 0) - (b.valence ?? 0));
    case "created_asc":
      return [...rows].toSorted(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    case "created_desc":
    default:
      return [...rows].toSorted(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }
}

export const limbicSearchToolDefs: ToolDef[] = [
  {
    name: "memory_limbic_search",
    description:
      "Search limbic emotional memories. Returns entries sorted by created_at desc by default. " +
      "Supports filtering by kind, intensity/valence range, conversation, and content query (case-insensitive substring). " +
      "Use to find emotional spikes, turning points, or conversation moods.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search content (case-insensitive substring). Optional; omit to list all.",
        },
        kind: {
          type: "string",
          enum: [...LIMBIC_KINDS],
          description: "Filter by kind: conversation_mood | turning_point | spike",
        },
        conversation_id: {
          type: "string",
          description: "Filter by conversation id",
        },
        min_intensity: {
          type: "number",
          description: "Minimum intensity (0.0-1.0, inclusive)",
        },
        max_intensity: {
          type: "number",
          description: "Maximum intensity (0.0-1.0, inclusive)",
        },
        min_valence: {
          type: "number",
          description: "Minimum valence (-1.0 to 1.0, inclusive)",
        },
        max_valence: {
          type: "number",
          description: "Maximum valence (-1.0 to 1.0, inclusive)",
        },
        order_by: {
          type: "string",
          enum: [
            "created_desc",
            "created_asc",
            "intensity_desc",
            "intensity_asc",
            "valence_desc",
            "valence_asc",
          ],
          description: "Sort order; default created_desc",
        },
        limit: {
          type: "number",
          description: "Max results, default 20, cap 100",
        },
        offset: {
          type: "number",
          description: "Pagination offset, default 0",
        },
      },
      required: [],
    },
    handler: async (args: Record<string, unknown>) => {
      const query = args.query !== undefined ? String(args.query).trim() : undefined;
      const kindRaw = args.kind !== undefined ? String(args.kind).trim() : undefined;
      const conversationId =
        args.conversation_id !== undefined ? String(args.conversation_id).trim() : undefined;
      const minIntensity = parseOptionalFloat(args.min_intensity);
      const maxIntensity = parseOptionalFloat(args.max_intensity);
      const minValence = parseOptionalFloat(args.min_valence);
      const maxValence = parseOptionalFloat(args.max_valence);
      const orderBy = args.order_by !== undefined ? String(args.order_by) : undefined;
      const limit = Math.max(1, Math.min(100, args.limit !== undefined ? Number(args.limit) : 20));
      const offset = Math.max(0, args.offset !== undefined ? Number(args.offset) : 0);

      if (minIntensity != null && (minIntensity < 0 || minIntensity > 1)) {
        return toolError("min_intensity must be between 0 and 1");
      }
      if (maxIntensity != null && (maxIntensity < 0 || maxIntensity > 1)) {
        return toolError("max_intensity must be between 0 and 1");
      }
      if (minValence != null && (minValence < -1 || minValence > 1)) {
        return toolError("min_valence must be between -1 and 1");
      }
      if (maxValence != null && (maxValence < -1 || maxValence > 1)) {
        return toolError("max_valence must be between -1 and 1");
      }

      if (kindRaw && !LIMBIC_KINDS.includes(kindRaw as (typeof LIMBIC_KINDS)[number])) {
        return toolError(`kind must be one of: ${LIMBIC_KINDS.join(", ")}`);
      }

      const kind = kindRaw as LimbicKind | undefined;

      try {
        // Use the store's list method for query/conversation_id/kind filtering
        let rows = await listLimbicMemory({
          query,
          conversation_id: conversationId,
          kind,
          limit: 500, // fetch more then filter/order/slice
        });

        // Apply range filters client-side
        rows = clampRange(rows, { minIntensity, maxIntensity, minValence, maxValence });

        const total = rows.length;

        // Sort
        rows = applyOrder(rows, orderBy);

        // Paginate
        const page = rows.slice(offset, offset + limit);

        const hits = page.map((r) => ({
          limbic_memory_id: r.id,
          kind: r.kind,
          conversation_id: r.conversation_id,
          content: r.content,
          intensity: r.intensity,
          valence: r.valence,
          arousal: r.arousal,
          source_segment: r.source_segment,
          semantic_memory_ids: r.semantic_memory_ids,
          created_at: r.created_at,
        }));

        return toolResult({
          total,
          offset,
          limit,
          results: hits,
        });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  },
  {
    name: "memory_limbic_get",
    description:
      "Get a single limbic memory by id. Returns the full record including content, kind, intensity, valence, arousal, conversation_id, and linked semantic_memory_ids.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Limbic memory id",
        },
      },
      required: ["id"],
    },
    handler: async (args: Record<string, unknown>) => {
      const id = String(args.id ?? "").trim();
      if (!id) return toolError("id is required");

      try {
        const row = await getLimbicMemory(id);
        if (!row) return toolError(`limbic memory not found: ${id}`);

        return toolResult({
          limbic_memory_id: row.id,
          kind: row.kind,
          conversation_id: row.conversation_id,
          content: row.content,
          intensity: row.intensity,
          valence: row.valence,
          arousal: row.arousal,
          source_segment: row.source_segment,
          semantic_memory_ids: row.semantic_memory_ids,
          created_at: row.created_at,
        });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  },
  {
    name: "memory_limbic_list_by_session",
    description:
      "List limbic memories for a specific conversation, ordered by created_at desc. Useful for reviewing the emotional arc of a single conversation.",
    parameters: {
      type: "object",
      properties: {
        conversation_id: {
          type: "string",
          description: "Session id",
        },
        limit: {
          type: "number",
          description: "Max results, default 20, cap 100",
        },
      },
      required: ["conversation_id"],
    },
    handler: async (args: Record<string, unknown>) => {
      const conversationId = String(args.conversation_id ?? "").trim();
      if (!conversationId) return toolError("conversation_id is required");
      const limit = Math.max(1, Math.min(100, args.limit !== undefined ? Number(args.limit) : 20));

      try {
        const rows = await listLimbicMemoryBySession(conversationId, { limit });
        const hits = rows.map((r) => ({
          limbic_memory_id: r.id,
          kind: r.kind,
          content: r.content,
          intensity: r.intensity,
          valence: r.valence,
          arousal: r.arousal,
          source_segment: r.source_segment,
          semantic_memory_ids: r.semantic_memory_ids,
          created_at: r.created_at,
        }));

        return toolResult({ conversation_id: conversationId, count: hits.length, results: hits });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  },
];
