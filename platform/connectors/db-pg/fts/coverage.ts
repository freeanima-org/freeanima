import { sql as drizzleSql } from "drizzle-orm";

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

/** FTS / segmentation / vector column coverage per table (indexable row base) */
export async function getFtsCoverageStats(): Promise<FtsCoverageStats> {
  const db = getDb();

  const [smRows, msgRows] = await Promise.all([
    db.execute<{
      total: number;
      fts: number;
      segmented: number;
      embedding: number;
    }>(drizzleSql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE content_fts IS NOT NULL)::int AS fts,
        count(*) FILTER (WHERE nullif(btrim(fts_segmented), '') IS NOT NULL)::int AS segmented,
        count(*) FILTER (WHERE content_embedding IS NOT NULL)::int AS embedding
      FROM semantic_memory
      WHERE status = 'active'
        AND length(btrim(content)) > 0
    `),
    db.execute<{
      total: number;
      fts: number;
      segmented: number;
      embedding: number;
    }>(drizzleSql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE content_fts IS NOT NULL)::int AS fts,
        count(*) FILTER (WHERE nullif(btrim(fts_segmented), '') IS NOT NULL)::int AS segmented,
        count(*) FILTER (WHERE content_embedding IS NOT NULL)::int AS embedding
      FROM messages
      WHERE content_fts IS NOT NULL
    `),
  ]);

  const sm = smRows[0] ?? { total: 0, fts: 0, segmented: 0, embedding: 0 };
  const msg = msgRows[0] ?? { total: 0, fts: 0, segmented: 0, embedding: 0 };

  return {
    tables: [
      { ...SEMANTIC_MEMORY_META, ...sm },
      { ...MESSAGES_META, ...msg },
    ],
  };
}
