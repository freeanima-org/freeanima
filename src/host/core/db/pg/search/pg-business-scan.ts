import { and, desc, eq, sql } from "drizzle-orm";
import { getActiveRuntimeConfig, getFtsTrgmMinSimilarity } from "@freeanima/host/core/config";
import { entities, messages } from "@freeanima/host/core/db/schema";
import { SEMANTIC_MEMORY_COMPONENT } from "@freeanima/host/core/db/schema";

import { getDb } from "../client.ts";
import { buildSemanticConditions } from "../semantic-memory/repos/semantic-filters.ts";
import { fuseSearchHits } from "./fusion.ts";
import { searchDocKey } from "./doc-key.ts";
import type { SearchBackend, SearchChannel, SearchDoc, SearchHit, SearchQuery } from "./types.ts";
import { UnsupportedSearchChannelError } from "./types.ts";

const SUPPORTED: SearchChannel[] = ["trgm"];

/**
 * Baseline backend: no side-table index; trgm over business columns only.
 * FTS/vector requests fail explicitly (no silent empty results).
 */
export function createPgBusinessScanBackend(): SearchBackend {
  return {
    id: "pg_business_scan",
    supportedChannels: () => [...SUPPORTED],

    async upsert(_docs: SearchDoc[]): Promise<void> {
      // No index storage.
    },

    async delete(_docKeys: string[]): Promise<void> {
      // No index storage.
    },

    async search(query: SearchQuery): Promise<SearchHit[]> {
      const unsupported = query.channels.filter((c) => !SUPPORTED.includes(c));
      if (unsupported.length > 0) {
        throw new UnsupportedSearchChannelError("pg_business_scan", unsupported);
      }
      const q = query.text.trim();
      if (!q) return [];
      const limit = Math.max(1, Math.min(200, query.limit ?? 10));
      const minSim = getFtsTrgmMinSimilarity(getActiveRuntimeConfig().data);
      const db = getDb();

      if (query.filters.resource === "message") {
        const conditions = [
          sql`word_similarity(coalesce(${messages.payload}->>'content', ''), ${q}) >= ${minSim}`,
        ];
        if (query.filters.conversation_id) {
          conditions.push(eq(messages.conversation_id, query.filters.conversation_id));
        }
        const rankExpr =
          sql<number>`similarity(coalesce(${messages.payload}->>'content', ''), ${q})`.as("rank");
        const rows = await db
          .select({
            id: messages.id,
            rank: rankExpr,
          })
          .from(messages)
          .where(and(...conditions))
          .orderBy(desc(rankExpr))
          .limit(limit);

        const hits: SearchHit[] = rows.map((r) => ({
          doc_key: searchDocKey("message", r.id),
          source_id: r.id,
          resource: "message",
          score: r.rank,
          channels_hit: ["trgm"],
          channel_scores: { trgm: r.rank },
        }));
        return fuseSearchHits({ trgm: hits }, { limit, fuse: "none" });
      }

      const conditions = [sql`word_similarity(${entities.content}, ${q}) >= ${minSim}`];
      if (query.filters.world_id != null) {
        conditions.push(eq(entities.world_id, query.filters.world_id));
      }
      if (query.filters.primary_component) {
        conditions.push(eq(entities.primary_component, query.filters.primary_component));
      }
      if (!query.filters.include_deleted) {
        conditions.push(sql`${entities.deleted_at} IS NULL`);
      }
      if (query.filters.primary_component === SEMANTIC_MEMORY_COMPONENT) {
        conditions.push(
          ...buildSemanticConditions({
            types: query.filters.semantic_types ?? [],
            status: query.filters.semantic_status ?? "active",
            source_conversations: query.filters.source_conversations ?? [],
          }),
        );
      }

      const rankExpr = sql<number>`similarity(${entities.content}, ${q})`.as("rank");
      const rows = await db
        .select({
          id: entities.id,
          rank: rankExpr,
        })
        .from(entities)
        .where(and(...conditions))
        .orderBy(desc(rankExpr))
        .limit(limit);

      const hits: SearchHit[] = rows.map((r) => ({
        doc_key: searchDocKey("entity", r.id),
        source_id: String(r.id),
        resource: "entity",
        score: r.rank,
        channels_hit: ["trgm"],
        channel_scores: { trgm: r.rank },
      }));
      return fuseSearchHits({ trgm: hits }, { limit, fuse: "none" });
    },
  };
}
