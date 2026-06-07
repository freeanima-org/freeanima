import { registerTool } from "@freeanima/engine-tool";
import type {
  AutobiographicalSignificance,
  AutobiographicalMemoryCreateInput,
} from "@freeanima/engine-repos";

import { getAutobiographicalMemoryStore } from "./autobiographical-port.ts";

const SIGNIFICANCE_VALUES = ["normal", "milestone", "turning_point"] as const;

function jsonResult(data: Record<string, unknown>): string {
  return JSON.stringify(data);
}

function jsonError(message: string): string {
  return JSON.stringify({ error: message });
}

function parseStringArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v).trim()).filter(Boolean);
}

export function registerAutobiographicalMemoryTools(): void {
  registerTool({
    name: "create_autobiographical_memory",
    description:
      "创建一条自传体叙事（只追加，正文写入后不可修改）。需提供 title 与 content；可选 significance/period/source_facts/source_sessions。",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "叙事标题" },
        content: { type: "string", description: "叙事正文" },
        significance: {
          type: "string",
          enum: [...SIGNIFICANCE_VALUES],
          description: "normal | milestone | turning_point",
        },
        period_start: { type: "string", description: "模糊时间起点" },
        period_end: { type: "string", description: "模糊时间终点" },
        source_facts: {
          type: "array",
          items: { type: "string" },
          description: "关联 semantic_memory id",
        },
        source_sessions: {
          type: "array",
          items: { type: "string" },
          description: "关联 session id",
        },
      },
      required: ["title", "content"],
    },
    handler: async (args: Record<string, unknown>) => {
      const title = String(args.title ?? "").trim();
      const content = String(args.content ?? "").trim();
      if (!title) return jsonError("title is required");
      if (!content) return jsonError("content is required");

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
        source_facts: parseStringArray(args.source_facts),
        source_sessions: parseStringArray(args.source_sessions),
      };

      try {
        const id = await getAutobiographicalMemoryStore().create(row);
        return jsonResult({ id, title });
      } catch (err) {
        return jsonError(err instanceof Error ? err.message : String(err));
      }
    },
  });

  registerTool({
    name: "deprecate_autobiographical_memory",
    description: "软废弃一条自传体叙事（正文不变，status=deprecated）。",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "autobiographical_memory id" },
      },
      required: ["id"],
    },
    handler: async (args: Record<string, unknown>) => {
      const id = String(args.id ?? "").trim();
      if (!id) return jsonError("id is required");
      try {
        const ok = await getAutobiographicalMemoryStore().deprecate(id);
        return jsonResult({ ok, id });
      } catch (err) {
        return jsonError(err instanceof Error ? err.message : String(err));
      }
    },
  });
}
