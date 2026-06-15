import { and, eq, isNotNull, sql } from "drizzle-orm";
import { messages, semanticMemory } from "@freeanima/core/db/schema";

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
    db
      .select({
        total: sql<number>`count(*)::int`,
        fts: sql<number>`count(*) FILTER (WHERE ${semanticMemory.contentFts} IS NOT NULL)::int`,
        segmented: sql<number>`count(*) FILTER (WHERE nullif(btrim(${semanticMemory.ftsSegmented}), '') IS NOT NULL)::int`,
        embedding: sql<number>`count(*) FILTER (WHERE ${semanticMemory.contentEmbedding} IS NOT NULL)::int`,
      })
      .from(semanticMemory)
      .where(
        and(eq(semanticMemory.status, "active"), sql`length(btrim(${semanticMemory.content})) > 0`),
      ),
    db
      .select({
        total: sql<number>`count(*)::int`,
        fts: sql<number>`count(*) FILTER (WHERE ${messages.contentFts} IS NOT NULL)::int`,
        segmented: sql<number>`count(*) FILTER (WHERE nullif(btrim(${messages.ftsSegmented}), '') IS NOT NULL)::int`,
        embedding: sql<number>`count(*) FILTER (WHERE ${messages.contentEmbedding} IS NOT NULL)::int`,
      })
      .from(messages)
      .where(isNotNull(messages.contentFts)),
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
