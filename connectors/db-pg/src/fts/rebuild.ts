import { sql as drizzleSql, type SQL } from "drizzle-orm";

import { getActiveConfig, isCjkJiebaEnabled, isEmbeddingEnabled } from "@freeanima/service-config";
import { logComponent } from "@freeanima/service-logging";

import { EMBEDDING_QUEUE_FLUSH_THRESHOLD } from "../embedding/batch-pack.ts";
import { embedAndStoreJobs } from "../embedding/embed-jobs.ts";
import { getEmbedTextFn } from "../embedding/runtime.ts";
import { getDb } from "../client.ts";
import { segmentForFts } from "./segment.ts";
import type { FtsRebuildOptions, FtsRebuildPhase } from "./rebuild-types.ts";

/** PG page size for fts_segmented rebuild. */
const REBUILD_DB_PAGE_SIZE = EMBEDDING_QUEUE_FLUSH_THRESHOLD;
/** Embedding rebuild: one row per round-trip; embed then store immediately. */
const REBUILD_EMBEDDING_PAGE_SIZE = 1;

const log = logComponent("embedding");

export type FtsRebuildResult = {
  tables: Record<string, number>;
  cjk_enabled: boolean;
  embedding_enabled: boolean;
  embeddings?: Record<string, number>;
};

function report(
  onProgress: FtsRebuildOptions["onProgress"],
  phase: FtsRebuildPhase,
  table: string,
  current: number,
  total: number,
): void {
  onProgress?.({ phase, table, current, total });
}

/** onlyMissing: head-of-queue LIMIT; full rebuild: keyset id cursor (OFFSET skips rows when filter shrinks). */
function idCursorFilter(onlyMissing: boolean, lastId: string): SQL {
  if (onlyMissing) return drizzleSql``;
  return drizzleSql`AND id > ${lastId}`;
}

function assertEmbeddingBatchStored(
  phase: FtsRebuildPhase,
  batchSize: number,
  stored: number,
): void {
  if (batchSize > 0 && stored === 0) {
    const msg = `${phase}: batch of ${batchSize} rows stored 0 embeddings (check API, dimensions, config)`;
    log.warn("embedding rebuild batch stored 0 rows", { phase, batch_size: batchSize });
    throw new Error(msg);
  }
}

async function countSemanticMemorySegmentedTargets(onlyMissing: boolean): Promise<number> {
  const db = getDb();
  const missing = onlyMissing
    ? drizzleSql`AND nullif(btrim(fts_segmented), '') IS NULL`
    : drizzleSql``;
  const rows = await db.execute<{ n: number }>(drizzleSql`
    SELECT count(*)::int AS n FROM semantic_memory WHERE length(btrim(content)) > 0 ${missing}
  `);
  return Number(rows[0]?.n ?? 0);
}

async function countMessagesSegmentedTargets(onlyMissing: boolean): Promise<number> {
  const db = getDb();
  const missing = onlyMissing
    ? drizzleSql`AND nullif(btrim(fts_segmented), '') IS NULL`
    : drizzleSql``;
  const rows = await db.execute<{ n: number }>(drizzleSql`
    SELECT count(*)::int AS n FROM messages WHERE content_fts IS NOT NULL ${missing}
  `);
  return Number(rows[0]?.n ?? 0);
}

async function countSemanticMemoryEmbeddingTargets(onlyMissing: boolean): Promise<number> {
  const db = getDb();
  const missing = onlyMissing ? drizzleSql`AND content_embedding IS NULL` : drizzleSql``;
  const rows = await db.execute<{ n: number }>(drizzleSql`
    SELECT count(*)::int AS n
    FROM semantic_memory
    WHERE status = 'active' AND length(btrim(content)) > 0 ${missing}
  `);
  return Number(rows[0]?.n ?? 0);
}

async function countMessagesEmbeddingTargets(onlyMissing: boolean): Promise<number> {
  const db = getDb();
  const missing = onlyMissing ? drizzleSql`AND content_embedding IS NULL` : drizzleSql``;
  const rows = await db.execute<{ n: number }>(drizzleSql`
    SELECT count(*)::int AS n FROM messages WHERE content_fts IS NOT NULL ${missing}
  `);
  return Number(rows[0]?.n ?? 0);
}

async function rebuildSemanticMemoryFtsSegmented(
  useJieba: boolean,
  opts: FtsRebuildOptions,
): Promise<number> {
  const onlyMissing = opts.onlyMissing ?? false;
  const total = useJieba ? await countSemanticMemorySegmentedTargets(onlyMissing) : 0;
  if (useJieba) {
    report(opts.onProgress, "semantic_memory_segmented", "semantic_memory", 0, total);
  }
  if (!useJieba || total === 0) return 0;

  const db = getDb();
  let updated = 0;
  let lastId = "";
  const missingFilter = onlyMissing
    ? drizzleSql`AND nullif(btrim(fts_segmented), '') IS NULL`
    : drizzleSql``;

  for (;;) {
    const rows = await db.execute<{ id: string; content: string }>(drizzleSql`
      SELECT id, content
      FROM semantic_memory
      WHERE length(btrim(content)) > 0 ${missingFilter} ${idCursorFilter(onlyMissing, lastId)}
      ORDER BY id
      LIMIT ${REBUILD_DB_PAGE_SIZE}
    `);
    if (!rows.length) break;

    for (const row of rows) {
      const ftsSegmented = await segmentForFts(row.content);
      await db.execute(drizzleSql`
        UPDATE semantic_memory
        SET fts_segmented = ${ftsSegmented}
        WHERE id = ${row.id}
      `);
      updated += 1;
      report(opts.onProgress, "semantic_memory_segmented", "semantic_memory", updated, total);
      lastId = row.id;
    }

    if (!onlyMissing && rows.length < REBUILD_DB_PAGE_SIZE) break;
  }

  return updated;
}

async function rebuildMessagesFtsSegmented(
  useJieba: boolean,
  opts: FtsRebuildOptions,
): Promise<number> {
  const onlyMissing = opts.onlyMissing ?? false;
  const total = useJieba ? await countMessagesSegmentedTargets(onlyMissing) : 0;
  if (useJieba) {
    report(opts.onProgress, "messages_segmented", "messages", 0, total);
  }
  if (!useJieba || total === 0) return 0;

  const db = getDb();
  let updated = 0;
  let lastId = "";
  const missingFilter = onlyMissing
    ? drizzleSql`AND nullif(btrim(fts_segmented), '') IS NULL`
    : drizzleSql``;

  for (;;) {
    const rows = await db.execute<{ id: string; content: string | null }>(drizzleSql`
      SELECT id, payload->>'content' AS content
      FROM messages
      WHERE content_fts IS NOT NULL ${missingFilter} ${idCursorFilter(onlyMissing, lastId)}
      ORDER BY id
      LIMIT ${REBUILD_DB_PAGE_SIZE}
    `);
    if (!rows.length) break;

    for (const row of rows) {
      const content = row.content ?? "";
      const ftsSegmented = content ? await segmentForFts(content) : null;
      await db.execute(drizzleSql`
        UPDATE messages
        SET fts_segmented = ${ftsSegmented}
        WHERE id = ${row.id}
      `);
      updated += 1;
      report(opts.onProgress, "messages_segmented", "messages", updated, total);
      lastId = row.id;
    }

    if (!onlyMissing && rows.length < REBUILD_DB_PAGE_SIZE) break;
  }

  return updated;
}

async function rebuildSemanticMemoryEmbeddings(opts: FtsRebuildOptions): Promise<number> {
  if (!getEmbedTextFn()) return 0;

  const onlyMissing = opts.onlyMissing ?? false;
  const total = await countSemanticMemoryEmbeddingTargets(onlyMissing);
  report(opts.onProgress, "semantic_memory_embedding", "semantic_memory", 0, total);
  if (total === 0) return 0;

  const db = getDb();
  let updated = 0;
  let lastId = "";
  const missingFilter = onlyMissing ? drizzleSql`AND content_embedding IS NULL` : drizzleSql``;

  for (;;) {
    const rows = await db.execute<{ id: string; content: string }>(drizzleSql`
      SELECT id, content
      FROM semantic_memory
      WHERE status = 'active'
        AND length(btrim(content)) > 0
        ${missingFilter}
        ${idCursorFilter(onlyMissing, lastId)}
      ORDER BY id
      LIMIT ${REBUILD_EMBEDDING_PAGE_SIZE}
    `);
    if (!rows.length) break;

    const row = rows[0]!;
    const stored = await embedAndStoreJobs([
      { kind: "semantic_memory", id: row.id, content: row.content },
    ]);
    assertEmbeddingBatchStored("semantic_memory_embedding", rows.length, stored);
    updated += stored;
    report(opts.onProgress, "semantic_memory_embedding", "semantic_memory", updated, total);

    if (!onlyMissing) {
      lastId = row.id;
    }
  }

  return updated;
}

async function rebuildMessagesEmbeddings(opts: FtsRebuildOptions): Promise<number> {
  if (!getEmbedTextFn()) return 0;

  const onlyMissing = opts.onlyMissing ?? false;
  const total = await countMessagesEmbeddingTargets(onlyMissing);
  report(opts.onProgress, "messages_embedding", "messages", 0, total);
  if (total === 0) return 0;

  const db = getDb();
  let updated = 0;
  let lastId = "";
  const missingFilter = onlyMissing ? drizzleSql`AND content_embedding IS NULL` : drizzleSql``;

  for (;;) {
    const rows = await db.execute<{ id: string; content: string | null }>(drizzleSql`
      SELECT id, payload->>'content' AS content
      FROM messages
      WHERE content_fts IS NOT NULL ${missingFilter} ${idCursorFilter(onlyMissing, lastId)}
      ORDER BY id
      LIMIT ${REBUILD_EMBEDDING_PAGE_SIZE}
    `);
    if (!rows.length) break;

    const row = rows[0]!;
    const stored = await embedAndStoreJobs([
      { kind: "message", id: row.id, content: row.content ?? "" },
    ]);
    assertEmbeddingBatchStored("messages_embedding", rows.length, stored);
    updated += stored;
    report(opts.onProgress, "messages_embedding", "messages", updated, total);

    if (!onlyMissing) {
      lastId = row.id;
    }
  }

  return updated;
}

/** Full refresh fts_segmented per cjk.enabled and vectors per embedding config */
export async function rebuildAllFtsSegments(
  opts: FtsRebuildOptions = {},
): Promise<FtsRebuildResult> {
  const useJieba = isCjkJiebaEnabled(getActiveConfig().data);
  const semantic_memory = await rebuildSemanticMemoryFtsSegmented(useJieba, opts);
  const messages = await rebuildMessagesFtsSegmented(useJieba, opts);

  const embedding_enabled = isEmbeddingEnabled(getActiveConfig().data) && getEmbedTextFn() != null;
  let embeddings: Record<string, number> | undefined;
  if (embedding_enabled) {
    const smEmb = await rebuildSemanticMemoryEmbeddings(opts);
    const msgEmb = await rebuildMessagesEmbeddings(opts);
    embeddings = { semantic_memory: smEmb, messages: msgEmb };
  }

  return {
    tables: { semantic_memory, messages },
    cjk_enabled: useJieba,
    embedding_enabled,
    embeddings,
  };
}

export type { FtsRebuildOptions, FtsRebuildPhase, FtsRebuildProgress } from "./rebuild-types.ts";
