import { and, eq, isNotNull, sql } from "drizzle-orm";
import {
  entities,
  messages,
  searchDocuments,
  SEMANTIC_MEMORY_COMPONENT,
} from "@freeanima/habitat/core/db/schema";

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

/** FTS / segmentation / vector coverage on `search_documents` (joined to business rows). */
export async function getFtsCoverageStats(): Promise<FtsCoverageStats> {
  const db = getDb();

  const [smRows, msgRows, entityRows] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        fts: sql<number>`count(*) FILTER (WHERE ${searchDocuments.search_fts} IS NOT NULL)::int`,
        segmented: sql<number>`count(*) FILTER (WHERE nullif(btrim(${searchDocuments.fts_segmented}), '') IS NOT NULL)::int`,
        embedding: sql<number>`count(*) FILTER (WHERE ${searchDocuments.embedding} IS NOT NULL)::int`,
      })
      .from(entities)
      .leftJoin(
        searchDocuments,
        and(
          eq(searchDocuments.resource, "entity"),
          sql`${searchDocuments.source_id} = ${entities.id}::text`,
        ),
      )
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
        fts: sql<number>`count(*) FILTER (WHERE ${searchDocuments.search_fts} IS NOT NULL)::int`,
        segmented: sql<number>`count(*) FILTER (WHERE nullif(btrim(${searchDocuments.fts_segmented}), '') IS NOT NULL)::int`,
        embedding: sql<number>`count(*) FILTER (WHERE ${searchDocuments.embedding} IS NOT NULL)::int`,
      })
      .from(messages)
      .innerJoin(
        searchDocuments,
        and(eq(searchDocuments.resource, "message"), eq(searchDocuments.source_id, messages.id)),
      )
      .where(isNotNull(searchDocuments.search_fts)),
    db
      .select({
        total: sql<number>`count(*)::int`,
        fts: sql<number>`count(*) FILTER (WHERE ${searchDocuments.search_fts} IS NOT NULL)::int`,
        segmented: sql<number>`count(*) FILTER (WHERE nullif(btrim(${searchDocuments.fts_segmented}), '') IS NOT NULL)::int`,
        embedding: sql<number>`count(*) FILTER (WHERE ${searchDocuments.embedding} IS NOT NULL)::int`,
      })
      .from(entities)
      .leftJoin(
        searchDocuments,
        and(
          eq(searchDocuments.resource, "entity"),
          sql`${searchDocuments.source_id} = ${entities.id}::text`,
        ),
      ).where(sql`length(btrim(
        coalesce(${entities.title}, '') || ' ' ||
        coalesce(${entities.summary}, '') || ' ' ||
        coalesce(${entities.content}, '')
      )) > 0`),
  ]);

  return {
    tables: [
      {
        ...SEMANTIC_MEMORY_META,
        total: smRows[0]?.total ?? 0,
        fts: smRows[0]?.fts ?? 0,
        segmented: smRows[0]?.segmented ?? 0,
        embedding: smRows[0]?.embedding ?? 0,
      },
      {
        ...MESSAGES_META,
        total: msgRows[0]?.total ?? 0,
        fts: msgRows[0]?.fts ?? 0,
        segmented: msgRows[0]?.segmented ?? 0,
        embedding: msgRows[0]?.embedding ?? 0,
      },
      {
        ...ENTITIES_META,
        total: entityRows[0]?.total ?? 0,
        fts: entityRows[0]?.fts ?? 0,
        segmented: entityRows[0]?.segmented ?? 0,
        embedding: entityRows[0]?.embedding ?? 0,
      },
    ],
  };
}
