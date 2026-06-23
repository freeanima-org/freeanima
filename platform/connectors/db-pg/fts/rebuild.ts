import { and, asc, eq, gt, isNotNull, isNull, sql as drizzleSql, type SQL } from "drizzle-orm";
import {
  autobiographicalMemory,
  limbicMemory,
  messages,
  semanticMemory,
} from "@freeanima/core/db/schema";

import { getActiveConfig, isCjkJiebaEnabled, isEmbeddingEnabled } from "@freeanima/platform/config";
import { logComponent } from "@freeanima/platform/logging";

import { EMBEDDING_QUEUE_FLUSH_THRESHOLD } from "../embedding/batch-pack.ts";
import { embedAndStoreJobs } from "../embedding/embed-jobs.ts";
import { getEmbedTextFn } from "../embedding/runtime.ts";
import { getDb } from "../client.ts";
import { autobiographicalIndexText } from "./memory-index-text.ts";
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

function idCursorCondition(_onlyMissing: boolean, lastId: string): SQL | undefined {
  if (!lastId) return undefined;
  return gt(semanticMemory.id, lastId);
}

function messageIdCursorCondition(_onlyMissing: boolean, lastId: string): SQL | undefined {
  if (!lastId) return undefined;
  return gt(messages.id, lastId);
}

function limbicIdCursorCondition(_onlyMissing: boolean, lastId: string): SQL | undefined {
  if (!lastId) return undefined;
  return gt(limbicMemory.id, lastId);
}

function autobiographicalIdCursorCondition(_onlyMissing: boolean, lastId: string): SQL | undefined {
  if (!lastId) return undefined;
  return gt(autobiographicalMemory.id, lastId);
}

function assertEmbeddingBatchStored(
  phase: FtsRebuildPhase,
  batchSize: number,
  stored: number,
  rowId: string,
): void {
  if (batchSize > 0 && stored === 0) {
    const msg = `${phase}: row ${rowId} stored 0 embeddings (check API, dimensions, config)`;
    log.error("embedding rebuild batch stored 0 rows", {
      phase,
      batch_size: batchSize,
      row_id: rowId,
    });
    throw new Error(msg);
  }
}

async function embedRebuildRow(
  phase: FtsRebuildPhase,
  job: {
    kind: "semantic_memory" | "message" | "limbic_memory" | "autobiographical_memory";
    id: string;
    content: string;
  },
): Promise<number> {
  const trimmed = job.content.trim();
  if (!trimmed) {
    log.warn("embedding rebuild skipping empty content", { phase, row_id: job.id });
    return 0;
  }
  const stored = await embedAndStoreJobs([{ ...job, content: trimmed }]);
  assertEmbeddingBatchStored(phase, 1, stored, job.id);
  return stored;
}

async function countSemanticMemorySegmentedTargets(onlyMissing: boolean): Promise<number> {
  const db = getDb();
  const conditions = [drizzleSql`length(btrim(${semanticMemory.content})) > 0`];
  if (onlyMissing) {
    conditions.push(drizzleSql`nullif(btrim(${semanticMemory.ftsSegmented}), '') IS NULL`);
  }
  const rows = await db
    .select({ n: drizzleSql<number>`count(*)::int` })
    .from(semanticMemory)
    .where(and(...conditions));
  return Number(rows[0]?.n ?? 0);
}

async function countMessagesSegmentedTargets(onlyMissing: boolean): Promise<number> {
  const db = getDb();
  const conditions = [isNotNull(messages.contentFts)];
  if (onlyMissing) {
    conditions.push(drizzleSql`nullif(btrim(${messages.ftsSegmented}), '') IS NULL`);
  }
  const rows = await db
    .select({ n: drizzleSql<number>`count(*)::int` })
    .from(messages)
    .where(and(...conditions));
  return Number(rows[0]?.n ?? 0);
}

async function countSemanticMemoryEmbeddingTargets(onlyMissing: boolean): Promise<number> {
  const db = getDb();
  const conditions = [
    eq(semanticMemory.status, "active"),
    drizzleSql`length(btrim(${semanticMemory.content})) > 0`,
  ];
  if (onlyMissing) conditions.push(isNull(semanticMemory.contentEmbedding));
  const rows = await db
    .select({ n: drizzleSql<number>`count(*)::int` })
    .from(semanticMemory)
    .where(and(...conditions));
  return Number(rows[0]?.n ?? 0);
}

async function countMessagesEmbeddingTargets(onlyMissing: boolean): Promise<number> {
  const db = getDb();
  const conditions = [isNotNull(messages.contentFts)];
  if (onlyMissing) conditions.push(isNull(messages.contentEmbedding));
  const rows = await db
    .select({ n: drizzleSql<number>`count(*)::int` })
    .from(messages)
    .where(and(...conditions));
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

  for (;;) {
    const baseConditions = [drizzleSql`length(btrim(${semanticMemory.content})) > 0`];
    if (onlyMissing) {
      baseConditions.push(drizzleSql`nullif(btrim(${semanticMemory.ftsSegmented}), '') IS NULL`);
    }
    const cursorCond = idCursorCondition(onlyMissing, lastId);
    if (cursorCond) baseConditions.push(cursorCond);

    const rows = await db
      .select({ id: semanticMemory.id, content: semanticMemory.content })
      .from(semanticMemory)
      .where(and(...baseConditions))
      .orderBy(asc(semanticMemory.id))
      .limit(REBUILD_DB_PAGE_SIZE);
    if (!rows.length) break;

    for (const row of rows) {
      const ftsSegmented = await segmentForFts(row.content);
      await db.update(semanticMemory).set({ ftsSegmented }).where(eq(semanticMemory.id, row.id));
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

  for (;;) {
    const baseConditions = [isNotNull(messages.contentFts)];
    if (onlyMissing) {
      baseConditions.push(drizzleSql`nullif(btrim(${messages.ftsSegmented}), '') IS NULL`);
    }
    const cursorCond = messageIdCursorCondition(onlyMissing, lastId);
    if (cursorCond) baseConditions.push(cursorCond);

    const rows = await db
      .select({
        id: messages.id,
        content: drizzleSql<string | null>`${messages.payload}->>'content'`,
      })
      .from(messages)
      .where(and(...baseConditions))
      .orderBy(asc(messages.id))
      .limit(REBUILD_DB_PAGE_SIZE);
    if (!rows.length) break;

    for (const row of rows) {
      const content = row.content ?? "";
      const ftsSegmented = content ? await segmentForFts(content) : null;
      await db.update(messages).set({ ftsSegmented }).where(eq(messages.id, row.id));
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

  for (;;) {
    const baseConditions = [
      eq(semanticMemory.status, "active"),
      drizzleSql`length(btrim(${semanticMemory.content})) > 0`,
    ];
    if (onlyMissing) baseConditions.push(isNull(semanticMemory.contentEmbedding));
    const cursorCond = idCursorCondition(onlyMissing, lastId);
    if (cursorCond) baseConditions.push(cursorCond);

    const rows = await db
      .select({ id: semanticMemory.id, content: semanticMemory.content })
      .from(semanticMemory)
      .where(and(...baseConditions))
      .orderBy(asc(semanticMemory.id))
      .limit(REBUILD_EMBEDDING_PAGE_SIZE);
    if (!rows.length) break;

    const row = rows[0]!;
    const stored = await embedRebuildRow("semantic_memory_embedding", {
      kind: "semantic_memory",
      id: row.id,
      content: row.content,
    });
    updated += stored;
    report(opts.onProgress, "semantic_memory_embedding", "semantic_memory", updated, total);
    lastId = row.id;
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

  for (;;) {
    const baseConditions = [isNotNull(messages.contentFts)];
    if (onlyMissing) baseConditions.push(isNull(messages.contentEmbedding));
    const cursorCond = messageIdCursorCondition(onlyMissing, lastId);
    if (cursorCond) baseConditions.push(cursorCond);

    const rows = await db
      .select({
        id: messages.id,
        content: drizzleSql<string | null>`${messages.payload}->>'content'`,
      })
      .from(messages)
      .where(and(...baseConditions))
      .orderBy(asc(messages.id))
      .limit(REBUILD_EMBEDDING_PAGE_SIZE);
    if (!rows.length) break;

    const row = rows[0]!;
    const stored = await embedRebuildRow("messages_embedding", {
      kind: "message",
      id: row.id,
      content: row.content ?? "",
    });
    updated += stored;
    report(opts.onProgress, "messages_embedding", "messages", updated, total);
    lastId = row.id;
  }

  return updated;
}

async function countLimbicMemorySegmentedTargets(onlyMissing: boolean): Promise<number> {
  const db = getDb();
  const conditions = [drizzleSql`length(btrim(${limbicMemory.content})) > 0`];
  if (onlyMissing) {
    conditions.push(drizzleSql`nullif(btrim(${limbicMemory.ftsSegmented}), '') IS NULL`);
  }
  const rows = await db
    .select({ n: drizzleSql<number>`count(*)::int` })
    .from(limbicMemory)
    .where(and(...conditions));
  return Number(rows[0]?.n ?? 0);
}

async function countAutobiographicalMemorySegmentedTargets(onlyMissing: boolean): Promise<number> {
  const db = getDb();
  const conditions = [
    eq(autobiographicalMemory.status, "active"),
    drizzleSql`length(btrim(${autobiographicalMemory.content})) > 0`,
  ];
  if (onlyMissing) {
    conditions.push(drizzleSql`nullif(btrim(${autobiographicalMemory.ftsSegmented}), '') IS NULL`);
  }
  const rows = await db
    .select({ n: drizzleSql<number>`count(*)::int` })
    .from(autobiographicalMemory)
    .where(and(...conditions));
  return Number(rows[0]?.n ?? 0);
}

async function countLimbicMemoryEmbeddingTargets(onlyMissing: boolean): Promise<number> {
  const db = getDb();
  const conditions = [drizzleSql`length(btrim(${limbicMemory.content})) > 0`];
  if (onlyMissing) conditions.push(isNull(limbicMemory.contentEmbedding));
  const rows = await db
    .select({ n: drizzleSql<number>`count(*)::int` })
    .from(limbicMemory)
    .where(and(...conditions));
  return Number(rows[0]?.n ?? 0);
}

async function countAutobiographicalMemoryEmbeddingTargets(onlyMissing: boolean): Promise<number> {
  const db = getDb();
  const conditions = [
    eq(autobiographicalMemory.status, "active"),
    drizzleSql`length(btrim(${autobiographicalMemory.content})) > 0`,
  ];
  if (onlyMissing) conditions.push(isNull(autobiographicalMemory.contentEmbedding));
  const rows = await db
    .select({ n: drizzleSql<number>`count(*)::int` })
    .from(autobiographicalMemory)
    .where(and(...conditions));
  return Number(rows[0]?.n ?? 0);
}

async function rebuildLimbicMemoryFtsSegmented(
  useJieba: boolean,
  opts: FtsRebuildOptions,
): Promise<number> {
  const onlyMissing = opts.onlyMissing ?? false;
  const total = useJieba ? await countLimbicMemorySegmentedTargets(onlyMissing) : 0;
  if (useJieba) {
    report(opts.onProgress, "limbic_memory_segmented", "limbic_memory", 0, total);
  }
  if (!useJieba || total === 0) return 0;

  const db = getDb();
  let updated = 0;
  let lastId = "";

  for (;;) {
    const baseConditions = [drizzleSql`length(btrim(${limbicMemory.content})) > 0`];
    if (onlyMissing) {
      baseConditions.push(drizzleSql`nullif(btrim(${limbicMemory.ftsSegmented}), '') IS NULL`);
    }
    const cursorCond = limbicIdCursorCondition(onlyMissing, lastId);
    if (cursorCond) baseConditions.push(cursorCond);

    const rows = await db
      .select({ id: limbicMemory.id, content: limbicMemory.content })
      .from(limbicMemory)
      .where(and(...baseConditions))
      .orderBy(asc(limbicMemory.id))
      .limit(REBUILD_DB_PAGE_SIZE);
    if (!rows.length) break;

    for (const row of rows) {
      const ftsSegmented = await segmentForFts(row.content);
      await db.update(limbicMemory).set({ ftsSegmented }).where(eq(limbicMemory.id, row.id));
      updated += 1;
      report(opts.onProgress, "limbic_memory_segmented", "limbic_memory", updated, total);
      lastId = row.id;
    }

    if (!onlyMissing && rows.length < REBUILD_DB_PAGE_SIZE) break;
  }

  return updated;
}

async function rebuildAutobiographicalMemoryFtsSegmented(
  useJieba: boolean,
  opts: FtsRebuildOptions,
): Promise<number> {
  const onlyMissing = opts.onlyMissing ?? false;
  const total = useJieba ? await countAutobiographicalMemorySegmentedTargets(onlyMissing) : 0;
  if (useJieba) {
    report(
      opts.onProgress,
      "autobiographical_memory_segmented",
      "autobiographical_memory",
      0,
      total,
    );
  }
  if (!useJieba || total === 0) return 0;

  const db = getDb();
  let updated = 0;
  let lastId = "";

  for (;;) {
    const baseConditions = [
      eq(autobiographicalMemory.status, "active"),
      drizzleSql`length(btrim(${autobiographicalMemory.content})) > 0`,
    ];
    if (onlyMissing) {
      baseConditions.push(
        drizzleSql`nullif(btrim(${autobiographicalMemory.ftsSegmented}), '') IS NULL`,
      );
    }
    const cursorCond = autobiographicalIdCursorCondition(onlyMissing, lastId);
    if (cursorCond) baseConditions.push(cursorCond);

    const rows = await db
      .select({
        id: autobiographicalMemory.id,
        title: autobiographicalMemory.title,
        content: autobiographicalMemory.content,
      })
      .from(autobiographicalMemory)
      .where(and(...baseConditions))
      .orderBy(asc(autobiographicalMemory.id))
      .limit(REBUILD_DB_PAGE_SIZE);
    if (!rows.length) break;

    for (const row of rows) {
      const indexText = autobiographicalIndexText(row.title, row.content);
      const ftsSegmented = indexText ? await segmentForFts(indexText) : null;
      await db
        .update(autobiographicalMemory)
        .set({ ftsSegmented })
        .where(eq(autobiographicalMemory.id, row.id));
      updated += 1;
      report(
        opts.onProgress,
        "autobiographical_memory_segmented",
        "autobiographical_memory",
        updated,
        total,
      );
      lastId = row.id;
    }

    if (!onlyMissing && rows.length < REBUILD_DB_PAGE_SIZE) break;
  }

  return updated;
}

async function rebuildLimbicMemoryEmbeddings(opts: FtsRebuildOptions): Promise<number> {
  if (!getEmbedTextFn()) return 0;

  const onlyMissing = opts.onlyMissing ?? false;
  const total = await countLimbicMemoryEmbeddingTargets(onlyMissing);
  report(opts.onProgress, "limbic_memory_embedding", "limbic_memory", 0, total);
  if (total === 0) return 0;

  const db = getDb();
  let updated = 0;
  let lastId = "";

  for (;;) {
    const baseConditions = [drizzleSql`length(btrim(${limbicMemory.content})) > 0`];
    if (onlyMissing) baseConditions.push(isNull(limbicMemory.contentEmbedding));
    const cursorCond = limbicIdCursorCondition(onlyMissing, lastId);
    if (cursorCond) baseConditions.push(cursorCond);

    const rows = await db
      .select({ id: limbicMemory.id, content: limbicMemory.content })
      .from(limbicMemory)
      .where(and(...baseConditions))
      .orderBy(asc(limbicMemory.id))
      .limit(REBUILD_EMBEDDING_PAGE_SIZE);
    if (!rows.length) break;

    const row = rows[0]!;
    const stored = await embedRebuildRow("limbic_memory_embedding", {
      kind: "limbic_memory",
      id: row.id,
      content: row.content,
    });
    updated += stored;
    report(opts.onProgress, "limbic_memory_embedding", "limbic_memory", updated, total);
    lastId = row.id;
  }

  return updated;
}

async function rebuildAutobiographicalMemoryEmbeddings(opts: FtsRebuildOptions): Promise<number> {
  if (!getEmbedTextFn()) return 0;

  const onlyMissing = opts.onlyMissing ?? false;
  const total = await countAutobiographicalMemoryEmbeddingTargets(onlyMissing);
  report(opts.onProgress, "autobiographical_memory_embedding", "autobiographical_memory", 0, total);
  if (total === 0) return 0;

  const db = getDb();
  let updated = 0;
  let lastId = "";

  for (;;) {
    const baseConditions = [
      eq(autobiographicalMemory.status, "active"),
      drizzleSql`length(btrim(${autobiographicalMemory.content})) > 0`,
    ];
    if (onlyMissing) baseConditions.push(isNull(autobiographicalMemory.contentEmbedding));
    const cursorCond = autobiographicalIdCursorCondition(onlyMissing, lastId);
    if (cursorCond) baseConditions.push(cursorCond);

    const rows = await db
      .select({
        id: autobiographicalMemory.id,
        title: autobiographicalMemory.title,
        content: autobiographicalMemory.content,
      })
      .from(autobiographicalMemory)
      .where(and(...baseConditions))
      .orderBy(asc(autobiographicalMemory.id))
      .limit(REBUILD_EMBEDDING_PAGE_SIZE);
    if (!rows.length) break;

    const row = rows[0]!;
    const stored = await embedRebuildRow("autobiographical_memory_embedding", {
      kind: "autobiographical_memory",
      id: row.id,
      content: autobiographicalIndexText(row.title, row.content),
    });
    updated += stored;
    report(
      opts.onProgress,
      "autobiographical_memory_embedding",
      "autobiographical_memory",
      updated,
      total,
    );
    lastId = row.id;
  }

  return updated;
}

/** Full refresh fts_segmented per cjk.enabled and vectors per embedding config */
export async function rebuildAllFtsSegments(
  opts: FtsRebuildOptions = {},
): Promise<FtsRebuildResult> {
  const useJieba = isCjkJiebaEnabled(getActiveConfig().data);
  const semantic_memory = await rebuildSemanticMemoryFtsSegmented(useJieba, opts);
  const messagesCount = await rebuildMessagesFtsSegmented(useJieba, opts);
  const limbic_memory = await rebuildLimbicMemoryFtsSegmented(useJieba, opts);
  const autobiographical_memory = await rebuildAutobiographicalMemoryFtsSegmented(useJieba, opts);

  const embedding_enabled = isEmbeddingEnabled(getActiveConfig().data) && getEmbedTextFn() != null;
  let embeddings: Record<string, number> | undefined;
  if (embedding_enabled) {
    const smEmb = await rebuildSemanticMemoryEmbeddings(opts);
    const msgEmb = await rebuildMessagesEmbeddings(opts);
    const lmEmb = await rebuildLimbicMemoryEmbeddings(opts);
    const abEmb = await rebuildAutobiographicalMemoryEmbeddings(opts);
    embeddings = {
      semantic_memory: smEmb,
      messages: msgEmb,
      limbic_memory: lmEmb,
      autobiographical_memory: abEmb,
    };
  }

  return {
    tables: { semantic_memory, messages: messagesCount, limbic_memory, autobiographical_memory },
    cjk_enabled: useJieba,
    embedding_enabled,
    embeddings,
  };
}

export type { FtsRebuildOptions, FtsRebuildPhase, FtsRebuildProgress } from "./rebuild-types.ts";
