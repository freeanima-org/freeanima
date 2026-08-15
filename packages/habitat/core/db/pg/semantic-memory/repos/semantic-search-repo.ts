import { and, desc, sql as drizzleSql } from "drizzle-orm";
import { entities, searchDocuments } from "@freeanima/habitat/core/db/schema";
import type { EntityRow } from "@freeanima/habitat/core/db/schema/entity";
import type { SemanticFtsHit } from "@freeanima/habitat/core/db/schema/rows";
import type {
  SemanticMemorySearchOpts,
  SemanticMemorySortBy,
} from "@freeanima/habitat/core/db/pg/semantic-memory/types";
import { omitUndefined } from "@freeanima/habitat/core/util";

import { getDb } from "../../client.ts";
import { hybridCountSemanticMemory, hybridSearchSemanticMemory } from "../../fts/hybrid-search.ts";
import { entitySearchDocumentsJoin } from "../../search/pg-search-index/channel-fts.ts";
import { entityToSemanticMemoryRow } from "../map-row.ts";
import { buildSemanticConditions } from "./semantic-filters.ts";

type SemanticSearchFilterOpts = Omit<SemanticMemorySearchOpts, "limit" | "offset">;

function normalizeSearchOpts(opts: SemanticSearchFilterOpts) {
  const types = opts.types?.filter(Boolean) ?? [];
  const status = opts.status ?? "active";
  const source_conversations =
    opts.source_conversations?.map((s: string) => s.trim()).filter(Boolean) ?? [];
  const q = opts.query?.trim() ?? "";
  return { types, status, source_conversations, q, cluster_id: opts.cluster_id };
}

function resolveEffectiveSort(
  q: string,
  sortBy: SemanticMemorySortBy | undefined,
): SemanticMemorySortBy {
  const resolved = sortBy ?? (q ? "rank" : "updated_at");
  if (q && resolved !== "rank") return "rank";
  if (!q && resolved === "rank") return "updated_at";
  return resolved;
}

function browseOrderBy(sortBy: Exclude<SemanticMemorySortBy, "rank">) {
  const orderBy = {
    created_at: [desc(entities.created_at)],
    updated_at: [desc(entities.updated_at)],
    reference_count: [desc(entities.reference_count), desc(entities.updated_at)],
  } as const;
  return orderBy[sortBy];
}

const semanticSelect = {
  id: entities.id,
  type: entities.type,
  world_id: entities.world_id,
  components: entities.components,
  primary_component: entities.primary_component,
  title: entities.title,
  summary: entities.summary,
  content: entities.content,
  body: entities.body,
  pinned: entities.pinned,
  reference_count: entities.reference_count,
  created_at: entities.created_at,
  updated_at: entities.updated_at,
  cluster_id: searchDocuments.cluster_id,
} as const;

function mapBrowseRow(row: {
  id: number;
  type: string;
  world_id: number;
  components: string[];
  primary_component: string | null;
  title: string;
  summary: string;
  content: string;
  body: unknown;
  pinned: boolean;
  reference_count: number;
  created_at: Date;
  updated_at: Date;
  cluster_id: number | null;
}): SemanticFtsHit {
  const entityRow: EntityRow = {
    id: row.id,
    type: row.type as EntityRow["type"],
    world_id: row.world_id,
    components: [...row.components],
    primary_component: row.primary_component,
    title: row.title ?? "",
    summary: row.summary ?? "",
    content: row.content ?? "",
    body: (row.body ?? {}) as Record<string, unknown>,
    pinned: row.pinned ?? false,
    reference_count: row.reference_count ?? 0,
    tag_ids: [],
    revisions: [],
    deleted_at: null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  return {
    ...entityToSemanticMemoryRow(entityRow),
    rank: 1.0,
    cluster_id: row.cluster_id ?? null,
  };
}

export async function searchSemanticMemory(
  opts: SemanticMemorySearchOpts,
): Promise<SemanticFtsHit[]> {
  const limit = Math.max(1, Math.min(100, opts.limit ?? 10));
  const offset = Math.max(0, opts.offset ?? 0);
  const { types, status, source_conversations, q, cluster_id } = normalizeSearchOpts(opts);
  const effectiveSort = resolveEffectiveSort(q, opts.sort_by);

  const db = getDb();
  if (effectiveSort === "rank") {
    if (!q) {
      return searchSemanticMemoryBrowse(
        db,
        omitUndefined({
          types,
          status,
          source_conversations,
          cluster_id,
          sortBy: "updated_at" as const,
          offset,
          limit,
        }),
      );
    }
    return hybridSearchSemanticMemory(
      q,
      omitUndefined({
        limit,
        offset,
        types,
        status,
        source_conversations,
        cluster_id,
      }),
    );
  }

  return searchSemanticMemoryBrowse(
    db,
    omitUndefined({
      types,
      status,
      source_conversations,
      cluster_id,
      sortBy: effectiveSort,
      offset,
      limit,
    }),
  );
}

async function searchSemanticMemoryBrowse(
  db: ReturnType<typeof getDb>,
  args: {
    types: string[];
    status: "active" | "deprecated" | "all";
    source_conversations: string[];
    cluster_id?: number | null;
    sortBy: Exclude<SemanticMemorySortBy, "rank">;
    offset: number;
    limit: number;
  },
): Promise<SemanticFtsHit[]> {
  const { types, status, source_conversations, cluster_id, sortBy, offset, limit } = args;
  const conditions = buildSemanticConditions(
    omitUndefined({
      types,
      status,
      source_conversations,
      cluster_id,
    }),
  );
  const rows = await db
    .select(semanticSelect)
    .from(entities)
    .leftJoin(searchDocuments, entitySearchDocumentsJoin())
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(...browseOrderBy(sortBy))
    .offset(offset)
    .limit(limit);
  return rows.map(mapBrowseRow);
}

export async function countSemanticMemorySearch(opts: SemanticSearchFilterOpts): Promise<number> {
  const { types, status, source_conversations, q, cluster_id } = normalizeSearchOpts(opts);

  const db = getDb();
  if (q) {
    return hybridCountSemanticMemory(
      q,
      omitUndefined({ types, status, source_conversations, cluster_id }),
    );
  }

  const conditions = buildSemanticConditions(
    omitUndefined({
      types,
      status,
      source_conversations,
      cluster_id,
    }),
  );
  const rows = await db
    .select({ n: drizzleSql<number>`count(*)::int` })
    .from(entities)
    .leftJoin(searchDocuments, entitySearchDocumentsJoin())
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  return rows[0]?.n ?? 0;
}
