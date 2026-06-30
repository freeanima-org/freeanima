import type { ToolSetRegistry } from "@freeanima/core/tool";
import { attachToolReturns, toolError, toolResult } from "@freeanima/core/tool";
import {
  formatFtsToolError,
  isFtsQueryError,
  omitUndefined,
  validateFtsQueryInput,
} from "@freeanima/core/util";
import type { EntitySearchMode } from "@freeanima/core/repos";
import type { EntityType } from "@freeanima/core/db/schema";

import {
  searchEntities,
  resolvePublicAccessibleWorldIds,
  listEntities,
} from "@freeanima/core/db/pg/entity";

const FTS_SYNTAX =
  "PG search syntax (to_tsquery simple):\n" +
  "- **Space**-separated terms default to **AND** (all must match)\n" +
  "- **OR** for broader recall: `deploy OR release`\n" +
  "- **AND** / **NOT**: `task AND urgent`, `task NOT done`\n" +
  '- **Double quotes** for phrases / CJK tokens: `"部署任务"`';

function asFloat(value: unknown, defaultVal: number): number {
  if (value == null || value === undefined) return defaultVal;
  const n = Number(value);
  return Number.isNaN(n) ? defaultVal : n;
}

function parseStringArray(raw: unknown): string[] | undefined {
  if (raw == null) return undefined;
  if (Array.isArray(raw)) return raw.map((v) => String(v));
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return undefined;
}

function parseFilters(raw: unknown): Record<string, unknown> | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return undefined;
}

function hitPayload(row: {
  id: number;
  type: EntityType;
  world_id: number;
  primary_component: string;
  title: string;
  summary: string;
  snippet?: string;
  rank?: number;
  body: Record<string, unknown>;
}) {
  return {
    id: row.id,
    type: row.type,
    world_id: row.world_id,
    primary_component: row.primary_component,
    title: row.title,
    summary: row.summary,
    snippet: row.snippet,
    rank: row.rank,
    body: row.body,
  };
}

export function registerEntitySearchTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "entity",
    "Unified entity composite search",
    attachToolReturns(
      [
        {
          name: "entity_search",
          exposeMcp: true,
          description:
            "Search entities by text (FTS + trigram + optional vector) with structured filters.\n" +
            "Default scope: single world_id. Use global=true only when cross-world search is intended.\n" +
            "Component filters (e.g. task_item.status) require primary_component.\n\n" +
            FTS_SYNTAX,
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search keywords; omit for filter-only browse",
              },
              world_id: { type: "number", description: "Owning world id (required unless global)" },
              global: { type: "boolean", description: "Cross-world search (needs permission)" },
              type: { type: "string", enum: ["content", "world", "agent", "user"] },
              primary_component: {
                type: "string",
                description: "e.g. task_item, task_list",
              },
              component: { type: "string", description: "Must include component tag" },
              filters: {
                type: "object",
                description: "Component-specific filters (task_item: status, list_id, tags, …)",
              },
              limit: { type: "number", description: "Max results, default 10, cap 50" },
              offset: { type: "number" },
              mode: { type: "string", enum: ["hybrid", "filter_only"] },
            },
          },
          handler: async (args) => {
            const query = String(args.query ?? "").trim();
            const global = args.global === true;
            const worldIdRaw = args.world_id;
            const world_id =
              worldIdRaw != null && worldIdRaw !== "" ? Number(worldIdRaw) : undefined;
            const limit = Math.max(1, Math.min(50, asFloat(args.limit, 10)));
            const offset = Math.max(0, asFloat(args.offset, 0));
            const mode = (
              args.mode === "filter_only" ? "filter_only" : "hybrid"
            ) as EntitySearchMode;

            if (!global && (world_id == null || !Number.isFinite(world_id) || world_id <= 0)) {
              return toolError("world_id is required unless global=true");
            }

            try {
              if (query) validateFtsQueryInput(query);

              let accessible_world_ids = parseStringArray(args.accessible_world_ids)?.map(Number);
              if (global && !accessible_world_ids?.length) {
                accessible_world_ids = await resolvePublicAccessibleWorldIds({
                  list: listEntities,
                });
              }

              const result = await searchEntities(
                omitUndefined({
                  query: query || undefined,
                  world_id: global ? undefined : world_id,
                  global,
                  accessible_world_ids,
                  type: args.type as EntityType | undefined,
                  primary_component:
                    args.primary_component != null ? String(args.primary_component) : undefined,
                  component: args.component != null ? String(args.component) : undefined,
                  filters: parseFilters(args.filters),
                  limit,
                  offset,
                  mode: query ? mode : "filter_only",
                }),
              );

              return toolResult({
                query: result.query,
                limit: result.limit,
                offset: result.offset,
                count: result.count,
                results: result.results.map(hitPayload),
              });
            } catch (e) {
              if (isFtsQueryError(e)) return toolError(formatFtsToolError(e));
              const msg = e instanceof Error ? e.message : String(e);
              if (msg.includes("accessible_world_ids") || msg.includes("world_id is required")) {
                return toolError(msg);
              }
              throw e;
            }
          },
        },
      ],
      {},
    ),
  );
}
