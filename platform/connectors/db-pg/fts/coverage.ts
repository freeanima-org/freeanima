import { and, eq, isNotNull, sql } from "drizzle-orm";
import {
  autobiographicalMemory,
  limbicMemory,
  messages,
  semanticMemory,
} from "@freeanima/core/db/schema";

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

const LIMBIC_MEMORY_META: Pick<FtsTableCoverageRow, "table" | "label" | "capabilities"> = {
  table: "limbic_memory",
  label: "Limbic memory",
  capabilities: { fts: true, segmented: true, trgm: true, embedding: true },
};

const AUTOBIOGRAPHICAL_MEMORY_META: Pick<FtsTableCoverageRow, "table" | "label" | "capabilities"> =
  {
    table: "autobiographical_memory",
    label: "Autobiographical memory",
    capabilities: { fts: true, segmented: true, trgm: true, embedding: true },
  };

/** FTS / segmentation / vector column coverage per table (indexable row base) */
export async function getFtsCoverageStats(): Promise<FtsCoverageStats> {
  const db = getDb();

  const [smRows, msgRows, lmRows, abRows] = await Promise.all([
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
    db
      .select({
        total: sql<number>`count(*)::int`,
        fts: sql<number>`count(*) FILTER (WHERE ${limbicMemory.contentFts} IS NOT NULL)::int`,
        segmented: sql<number>`count(*) FILTER (WHERE nullif(btrim(${limbicMemory.ftsSegmented}), '') IS NOT NULL)::int`,
        embedding: sql<number>`count(*) FILTER (WHERE ${limbicMemory.contentEmbedding} IS NOT NULL)::int`,
      })
      .from(limbicMemory)
      .where(sql`length(btrim(${limbicMemory.content})) > 0`),
    db
      .select({
        total: sql<number>`count(*)::int`,
        fts: sql<number>`count(*) FILTER (WHERE ${autobiographicalMemory.contentFts} IS NOT NULL)::int`,
        segmented: sql<number>`count(*) FILTER (WHERE nullif(btrim(${autobiographicalMemory.ftsSegmented}), '') IS NOT NULL)::int`,
        embedding: sql<number>`count(*) FILTER (WHERE ${autobiographicalMemory.contentEmbedding} IS NOT NULL)::int`,
      })
      .from(autobiographicalMemory)
      .where(
        and(
          eq(autobiographicalMemory.status, "active"),
          sql`length(btrim(${autobiographicalMemory.content})) > 0`,
        ),
      ),
  ]);

  const sm = smRows[0] ?? { total: 0, fts: 0, segmented: 0, embedding: 0 };
  const msg = msgRows[0] ?? { total: 0, fts: 0, segmented: 0, embedding: 0 };
  const lm = lmRows[0] ?? { total: 0, fts: 0, segmented: 0, embedding: 0 };
  const ab = abRows[0] ?? { total: 0, fts: 0, segmented: 0, embedding: 0 };

  return {
    tables: [
      { ...SEMANTIC_MEMORY_META, ...sm },
      { ...MESSAGES_META, ...msg },
      { ...LIMBIC_MEMORY_META, ...lm },
      { ...AUTOBIOGRAPHICAL_MEMORY_META, ...ab },
    ],
  };
}
