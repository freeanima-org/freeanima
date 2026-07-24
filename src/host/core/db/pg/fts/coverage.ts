import { and, eq, isNotNull, sql } from "drizzle-orm";
import { entities, messages, SEMANTIC_MEMORY_COMPONENT } from "@freeanima/host/core/db/schema";

import { getDb } from "../client.ts";

export type FtsTableCapabilities = {
  fts: boolean;
  segmented: boolean;
  trgm: boolean;
  embedding: boolean;
};

export type FtsTableCoverageRow = {
  table: string;
  label: string;
  capabilities: FtsTableCapabilities;
  total: number;
  fts: number;
  segmented: number;
  embedding: number;
};

export type FtsCoverageStats = {
  tables: FtsTableCoverageRow[];
};

const SEMANTIC_MEMORY_META: Pick<FtsTableCoverageRow, "table" | "label" | "capabilities"> = {
  table: "semantic_memory",
  label: "Semantic memory",
  capabilities: { fts: true, segmented: true, trgm: true, embedding: true },
};

const MESSAGES_META: Pick<FtsTableCoverageRow, "table" | "label" | "capabilities"> = {
  table: "messages",
  label: "Conversation messages",
  capabilities: { fts: true, segmented: true, trgm: true, embedding: true },
};

const ENTITIES_META: Pick<FtsTableCoverageRow, "table" | "label" | "capabilities"> = {
  table: "entities",
  label: "Entities",
  capabilities: { fts: true, segmented: true, trgm: true, embedding: true },
};

/** FTS / segmentation / vector column coverage per table (indexable row base) */
export async function getFtsCoverageStats(): Promise<FtsCoverageStats> {
  const db = getDb();

  const [smRows, msgRows, entityRows] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        fts: sql<number>`count(*) FILTER (WHERE ${entities.search_fts} IS NOT NULL)::int`,
        segmented: sql<number>`count(*) FILTER (WHERE nullif(btrim(${entities.fts_segmented}), '') IS NOT NULL)::int`,
        embedding: sql<number>`count(*) FILTER (WHERE ${entities.search_embedding} IS NOT NULL)::int`,
      })
      .from(entities)
      .where(
        and(
          eq(entities.primary_component, SEMANTIC_MEMORY_COMPONENT),
          sql`${entities.body}->>'status' = 'active'`,
          sql`length(btrim(${entities.content})) > 0`,
        ),
      ),
    db
      .select({
        total: sql<number>`count(*)::int`,
        fts: sql<number>`count(*) FILTER (WHERE ${messages.content_fts} IS NOT NULL)::int`,
        segmented: sql<number>`count(*) FILTER (WHERE nullif(btrim(${messages.fts_segmented}), '') IS NOT NULL)::int`,
        embedding: sql<number>`count(*) FILTER (WHERE ${messages.content_embedding} IS NOT NULL)::int`,
      })
      .from(messages)
      .where(isNotNull(messages.content_fts)),
    db
      .select({
        total: sql<number>`count(*)::int`,
        fts: sql<number>`count(*) FILTER (WHERE ${entities.search_fts} IS NOT NULL)::int`,
        segmented: sql<number>`count(*) FILTER (WHERE nullif(btrim(${entities.fts_segmented}), '') IS NOT NULL)::int`,
        embedding: sql<number>`count(*) FILTER (WHERE ${entities.search_embedding} IS NOT NULL)::int`,
      })
      .from(entities)
      .where(
        sql`length(btrim(
          coalesce(${entities.title}, '') || ' ' ||
          coalesce(${entities.summary}, '') || ' ' ||
          coalesce(${entities.content}, '')
        )) > 0`,
      ),
  ]);

  const sm = smRows[0] ?? { total: 0, fts: 0, segmented: 0, embedding: 0 };
  const msg = msgRows[0] ?? { total: 0, fts: 0, segmented: 0, embedding: 0 };
  const ent = entityRows[0] ?? { total: 0, fts: 0, segmented: 0, embedding: 0 };

  return {
    tables: [
      { ...SEMANTIC_MEMORY_META, ...sm },
      { ...MESSAGES_META, ...msg },
      { ...ENTITIES_META, ...ent },
    ],
  };
}
