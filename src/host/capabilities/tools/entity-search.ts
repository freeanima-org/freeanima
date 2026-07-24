import type { ToolSetRegistry } from "@freeanima/host/core/tool";
import {
  attachToolReturns,
  toolError,
  toolResult,
  resolveToolCallerSubjectId,
} from "@freeanima/host/core/tool";
import {
  resolveToolWorld,
  resolveWorldsAccessibleBySubject,
  listEntities,
  searchEntities,
  ToolWorldAccessError,
} from "@freeanima/host/core/db/pg/entity";
import {
  formatFtsToolError,
  isFtsQueryError,
  omitUndefined,
  validateFtsQueryInput,
} from "@freeanima/host/core/util";
import type { EntitySearchMode } from "@freeanima/host/core/db/pg/entity/types";
import type { EntityType } from "@freeanima/host/core/db/schema";

const FTS_SYNTAX =
  "PG search syntax (to_tsquery simple):\n" +
  "- **Space**-separated terms default to **OR** (any term may match)\n" +
  "- **AND** for stricter match: `task AND urgent`\n" +
  "- **OR** / **NOT**: `deploy OR release`, `task NOT done`\n" +
  '- **Double quotes** for phrases / CJK tokens: `"部署任务"` (short CJK = proximity; long CJK = bigram OR)';

function asFloat(value: unknown, defaultVal: number): number {
  if (value == null || value === undefined) return defaultVal;
  const n = Number(value);
  return Number.isNaN(n) ? defaultVal : n;
}

function parseFilters(raw: unknown): Record<string, unknown> | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return undefined;
}

function parseExplicitWorldId(raw: unknown): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
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
          description:
            "Search entities by text (FTS + trigram) with structured filters.\n" +
            "Default scope: caller subject private world. Use global=true for cross-world search within caller permissions.\n" +
            "Component filters (e.g. task_item.status) require primary_component.\n\n" +
            FTS_SYNTAX,
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search keywords; omit for filter-only browse",
              },
              world_id: {
                type: "number",
                description: "Optional world override; defaults to caller subject private world",
              },
              global: { type: "boolean", description: "Cross-world search (caller permissions)" },
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
            const explicitWorldId = parseExplicitWorldId(args.world_id);
            const filters = parseFilters(args.filters);
            const filterListId =
              filters?.list_id != null && Number.isFinite(Number(filters.list_id))
                ? Number(filters.list_id)
                : undefined;
            const limit = Math.max(1, Math.min(50, asFloat(args.limit, 10)));
            const offset = Math.max(0, asFloat(args.offset, 0));
            const mode = (
              args.mode === "filter_only" ? "filter_only" : "hybrid"
            ) as EntitySearchMode;

            try {
              if (query) validateFtsQueryInput(query);

              let accessible_world_ids: number[] | undefined;
              if (global) {
                accessible_world_ids = await resolveWorldsAccessibleBySubject(
                  { list: listEntities },
                  resolveToolCallerSubjectId(),
                );
              }

              let world_id: number | undefined;
              if (!global) {
                world_id = await resolveToolWorld({
                  ...(explicitWorldId != null ? { explicitWorldId } : {}),
                  ...(filterListId != null ? { listId: filterListId } : {}),
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
                  filters,
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
              if (e instanceof ToolWorldAccessError) return toolError(e.message);
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
