import { and, desc, sql as drizzleSql } from "drizzle-orm";
import { semanticMemory } from "@freeanima/core/db/schema";
import type {
  SemanticFtsHit,
  SemanticMemorySearchOpts,
  SemanticMemorySortBy,
} from "@freeanima/core/repos";

import { getDb } from "../../client.ts";
import { hybridCountSemanticMemory, hybridSearchSemanticMemory } from "../../fts/hybrid-search.ts";
import { buildSemanticConditions } from "./semantic-filters.ts";

type SemanticSearchFilterOpts = Omit<SemanticMemorySearchOpts, "limit" | "offset">;

function normalizeSearchOpts(opts: SemanticSearchFilterOpts) {
  const types = opts.types?.filter(Boolean) ?? [];
  const status = opts.status ?? "active";
  const source_conversations =
    opts.source_conversations?.map((s: string) => s.trim()).filter(Boolean) ?? [];
  const q = opts.query?.trim() ?? "";
  return { types, status, source_conversations, q };
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
    created_at: [desc(semanticMemory.created_at)],
    updated_at: [desc(semanticMemory.updated_at)],
    reference_count: [desc(semanticMemory.reference_count), desc(semanticMemory.updated_at)],
  } as const;
  return orderBy[sortBy];
}

export async function searchSemanticMemory(
  opts: SemanticMemorySearchOpts,
): Promise<SemanticFtsHit[]> {
  const limit = Math.max(1, Math.min(100, opts.limit ?? 10));
  const offset = Math.max(0, opts.offset ?? 0);
  const { types, status, source_conversations, q } = normalizeSearchOpts(opts);
  const effectiveSort = resolveEffectiveSort(q, opts.sort_by);

  const db = getDb();
  if (effectiveSort === "rank") {
    if (!q) {
      return searchSemanticMemoryBrowse(db, {
        types,
        status,
        source_conversations,
        sortBy: "updated_at",
        offset,
        limit,
      });
    }
    return hybridSearchSemanticMemory(q, {
      limit,
      offset,
      types,
      status,
      source_conversations,
    });
  }

  return searchSemanticMemoryBrowse(db, {
    types,
    status,
    source_conversations,
    sortBy: effectiveSort,
    offset,
    limit,
  });
}

async function searchSemanticMemoryBrowse(
  db: ReturnType<typeof getDb>,
  args: {
    types: string[];
    status: "active" | "deprecated" | "all";
    source_conversations: string[];
    sortBy: Exclude<SemanticMemorySortBy, "rank">;
    offset: number;
    limit: number;
  },
): Promise<SemanticFtsHit[]> {
  const { types, status, source_conversations, sortBy, offset, limit } = args;
  const conditions = buildSemanticConditions({ types, status, source_conversations });
  const rows = await db
    .select()
    .from(semanticMemory)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(...browseOrderBy(sortBy))
    .offset(offset)
    .limit(limit);
  return rows.map((r) => ({
    ...r,
    rank: 1.0,
  }));
}

export async function countSemanticMemorySearch(opts: SemanticSearchFilterOpts): Promise<number> {
  const { types, status, source_conversations, q } = normalizeSearchOpts(opts);

  const db = getDb();
  if (q) {
    return hybridCountSemanticMemory(q, { types, status, source_conversations });
  }

  const conditions = buildSemanticConditions({ types, status, source_conversations });
  const rows = await db
    .select({ n: drizzleSql<number>`count(*)::int` })
    .from(semanticMemory)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  return Number(rows[0]?.n ?? 0);
}
