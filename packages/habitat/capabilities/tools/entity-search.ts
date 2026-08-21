import {
  attachToolReturns,
  toolError,
  toolResult,
  resolveToolCallerSubjectId,
  type ToolSetRegistry,
} from "@freeanima/habitat/core/tool";
import {
  assertSubjectCanAccessWorld,
  getEntity,
  resolveToolWorld,
  resolveWorldsAccessibleBySubject,
  listEntities,
  searchEntities,
  ToolWorldAccessError,
} from "@freeanima/habitat/core/db/pg/entity";
import {
  formatFtsToolError,
  isFtsQueryError,
  omitUndefined,
  validateFtsQueryInput,
} from "@freeanima/habitat/core/util";
import type { EntitySearchMode } from "@freeanima/habitat/core/db/pg/entity/types";
import { entityTypeSchema, type EntityType } from "@freeanima/habitat/core/db/schema";
import { coerceString } from "@freeanima/shared/coerce-string";
import { asRecord } from "@freeanima/shared/util";

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
  return asRecord(raw) ?? undefined;
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
  primary_component: string | null;
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

/** Resolve `[[anima:id]]` / entity id with caller world access check. */
export async function handleEntityGet(args: Record<string, unknown>): Promise<string> {
  const id = Number(args.id);
  if (!Number.isInteger(id) || id <= 0) {
    return toolError("id must be a positive integer");
  }
  try {
    const row = await getEntity(id);
    if (!row) {
      return toolError(`entity not found: ${id}`);
    }
    await assertSubjectCanAccessWorld(resolveToolCallerSubjectId(), row.world_id, {
      access: "read",
    });
    return toolResult(
      hitPayload({
        id: row.id,
        type: row.type,
        world_id: row.world_id,
        primary_component: row.primary_component,
        title: row.title,
        summary: row.summary,
        body: row.body,
      }),
    );
  } catch (e) {
    if (e instanceof ToolWorldAccessError) return toolError(e.message);
    throw e;
  }
}

export function buildEntitySearchToolDefs() {
  return attachToolReturns(
    [
      {
        name: "entity_get",
        description:
          "Get one entity by id (`entities.id` / `[[anima:id]]`). Returns primary_component, title, summary, body. " +
          "Use this first to resolve entity refs, then call the domain tool for that component (e.g. task_get).",
        parameters: {
          type: "object",
          properties: {
            id: { type: "integer", description: "entities.id from [[anima:id]]" },
          },
          required: ["id"],
        },
        handler: handleEntityGet,
      },
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
              additionalProperties: true,
              description: "Component-specific filters (task_item: status, list_id, tags, …)",
            },
            limit: { type: "number", description: "Max results, default 10, cap 50" },
            offset: { type: "number" },
            mode: { type: "string", enum: ["hybrid", "filter_only"] },
          },
        },
        handler: async (args) => {
          const query = coerceString(args.query ?? "").trim();
          const global = args.global === true;
          const explicitWorldId = parseExplicitWorldId(args.world_id);
          const filters = parseFilters(args.filters);
          const filterListId =
            filters?.list_id != null && Number.isFinite(Number(filters.list_id))
              ? Number(filters.list_id)
              : undefined;
          const limit = Math.max(1, Math.min(50, asFloat(args.limit, 10)));
          const offset = Math.max(0, asFloat(args.offset, 0));
          const mode: EntitySearchMode = args.mode === "filter_only" ? "filter_only" : "hybrid";
          const typeParsed = entityTypeSchema.safeParse(args.type);

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
                type: typeParsed.success ? typeParsed.data : undefined,
                primary_component:
                  args.primary_component != null ? coerceString(args.primary_component) : undefined,
                component: args.component != null ? coerceString(args.component) : undefined,
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
              truncated: result.count >= limit,
              ...(result.count >= limit
                ? {
                    next_hint:
                      "Page full for this limit; raise offset or refine filters/query and call entity_search again.",
                  }
                : {}),
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
  );
}

/** Test/compat helper — production registers entity+tag via platform `registerEntityAndTagTools`. */
export function registerEntitySearchTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "entity",
    "Entity lookup/search and per-world tags (resolve [[anima:id]] via entity_get)",
    buildEntitySearchToolDefs(),
  );
}
