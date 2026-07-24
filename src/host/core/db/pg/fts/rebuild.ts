import { and, asc, eq, gt, isNotNull, isNull, sql as drizzleSql, type SQL } from "drizzle-orm";
import { entities, messages, SEMANTIC_MEMORY_COMPONENT } from "@freeanima/host/core/db/schema";
import { entitySearchTextForWrite } from "@freeanima/host/core/db/schema/entity";

import {
  getActiveRuntimeConfig,
  isCjkJiebaEnabled,
  isEmbeddingEnabled,
} from "@freeanima/host/core/config";
import { omitUndefined } from "@freeanima/host/core/util";
import { logPgComponent } from "../log.ts";

import { EMBEDDING_QUEUE_FLUSH_THRESHOLD } from "../embedding/batch-pack.ts";
import { embedAndStoreJobs } from "../embedding/embed-jobs.ts";
import { getEmbedTextFn } from "../embedding/runtime.ts";
import { getDb } from "../client.ts";
import { segmentForFts } from "./segment.ts";
import type { FtsRebuildOptions, FtsRebuildPhase } from "./rebuild-types.ts";

/** PG page size for fts_segmented rebuild. */
const REBUILD_DB_PAGE_SIZE = EMBEDDING_QUEUE_FLUSH_THRESHOLD;
/** Embedding rebuild：按批读取，再交给 embedAndStoreJobs（支持 batch API） */
const REBUILD_EMBEDDING_PAGE_SIZE = EMBEDDING_QUEUE_FLUSH_THRESHOLD;

const log = logPgComponent("embedding");

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

function semanticMemoryPrimaryCondition(): SQL {
  return eq(entities.primary_component, SEMANTIC_MEMORY_COMPONENT);
}

function semanticMemoryActiveCondition(): SQL {
  return drizzleSql`${entities.body}->>'status' = 'active'`;
}

function semanticMemoryIdCursorCondition(_onlyMissing: boolean, lastId: number): SQL | undefined {
  if (!lastId) return undefined;
  return gt(entities.id, lastId);
}

function messageIdCursorCondition(_onlyMissing: boolean, lastId: string): SQL | undefined {
  if (!lastId) return undefined;
  return gt(messages.id, lastId);
}

function entityIdCursorCondition(_onlyMissing: boolean, lastId: number): SQL | undefined {
  if (!lastId) return undefined;
  return gt(entities.id, lastId);
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
  const conditions = [
    semanticMemoryPrimaryCondition(),
    drizzleSql`length(btrim(${entities.content})) > 0`,
  ];
  if (onlyMissing) {
    conditions.push(drizzleSql`nullif(btrim(${entities.fts_segmented}), '') IS NULL`);
  }
  const rows = await db
    .select({ n: drizzleSql<number>`count(*)::int` })
    .from(entities)
    .where(and(...conditions));
  return Number(rows[0]?.n ?? 0);
}

async function countEntitiesSegmentedTargets(onlyMissing: boolean): Promise<number> {
  const db = getDb();
  const conditions = [
    drizzleSql`length(btrim(
      coalesce(${entities.title}, '') || ' ' ||
      coalesce(${entities.summary}, '') || ' ' ||
      coalesce(${entities.content}, '')
    )) > 0`,
  ];
  if (onlyMissing) {
    conditions.push(drizzleSql`nullif(btrim(${entities.fts_segmented}), '') IS NULL`);
  }
  const rows = await db
    .select({ n: drizzleSql<number>`count(*)::int` })
    .from(entities)
    .where(and(...conditions));
  return Number(rows[0]?.n ?? 0);
}

async function countMessagesSegmentedTargets(onlyMissing: boolean): Promise<number> {
  const db = getDb();
  const conditions = [isNotNull(messages.content_fts)];
  if (onlyMissing) {
    conditions.push(drizzleSql`nullif(btrim(${messages.fts_segmented}), '') IS NULL`);
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
    semanticMemoryPrimaryCondition(),
    semanticMemoryActiveCondition(),
    drizzleSql`length(btrim(${entities.content})) > 0`,
  ];
  if (onlyMissing) conditions.push(isNull(entities.search_embedding));
  const rows = await db
    .select({ n: drizzleSql<number>`count(*)::int` })
    .from(entities)
    .where(and(...conditions));
  return Number(rows[0]?.n ?? 0);
}

async function countMessagesEmbeddingTargets(onlyMissing: boolean): Promise<number> {
  const db = getDb();
  const conditions = [isNotNull(messages.content_fts)];
  if (onlyMissing) conditions.push(isNull(messages.content_embedding));
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
  let lastId = 0;

  for (;;) {
    const baseConditions = [
      semanticMemoryPrimaryCondition(),
      drizzleSql`length(btrim(${entities.content})) > 0`,
    ];
    if (onlyMissing) {
      baseConditions.push(drizzleSql`nullif(btrim(${entities.fts_segmented}), '') IS NULL`);
    }
    const cursorCond = semanticMemoryIdCursorCondition(onlyMissing, lastId);
    if (cursorCond) baseConditions.push(cursorCond);

    const rows = await db
      .select({ id: entities.id, content: entities.content })
      .from(entities)
      .where(and(...baseConditions))
      .orderBy(asc(entities.id))
      .limit(REBUILD_DB_PAGE_SIZE);
    if (rows.length === 0) break;

    for (const row of rows) {
      const fts_segmented = await segmentForFts(row.content);
      await db.update(entities).set({ fts_segmented }).where(eq(entities.id, row.id));
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
    const baseConditions = [isNotNull(messages.content_fts)];
    if (onlyMissing) {
      baseConditions.push(drizzleSql`nullif(btrim(${messages.fts_segmented}), '') IS NULL`);
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
    if (rows.length === 0) break;

    for (const row of rows) {
      const content = row.content ?? "";
      const fts_segmented = content ? await segmentForFts(content) : null;
      await db.update(messages).set({ fts_segmented }).where(eq(messages.id, row.id));
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
  let lastId = 0;

  for (;;) {
    const baseConditions = [
      semanticMemoryPrimaryCondition(),
      semanticMemoryActiveCondition(),
      drizzleSql`length(btrim(${entities.content})) > 0`,
    ];
    if (onlyMissing) baseConditions.push(isNull(entities.search_embedding));
    const cursorCond = semanticMemoryIdCursorCondition(onlyMissing, lastId);
    if (cursorCond) baseConditions.push(cursorCond);

    const rows = await db
      .select({ id: entities.id, content: entities.content })
      .from(entities)
      .where(and(...baseConditions))
      .orderBy(asc(entities.id))
      .limit(REBUILD_EMBEDDING_PAGE_SIZE);
    if (rows.length === 0) break;

    const row = rows[0];
    if (!row) break;
    const stored = await embedRebuildRow("semantic_memory_embedding", {
      kind: "semantic_memory",
      id: String(row.id),
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
    const baseConditions = [isNotNull(messages.content_fts)];
    if (onlyMissing) baseConditions.push(isNull(messages.content_embedding));
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
    if (rows.length === 0) break;

    const row = rows[0];
    if (!row) break;
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

async function rebuildLimbicMemoryFtsSegmented(
  _useJieba: boolean,
  _opts: FtsRebuildOptions,
): Promise<number> {
  return 0;
}

async function rebuildAutobiographicalMemoryFtsSegmented(
  _useJieba: boolean,
  _opts: FtsRebuildOptions,
): Promise<number> {
  return 0;
}

async function rebuildLimbicMemoryEmbeddings(_opts: FtsRebuildOptions): Promise<number> {
  return 0;
}

async function rebuildAutobiographicalMemoryEmbeddings(_opts: FtsRebuildOptions): Promise<number> {
  return 0;
}

async function rebuildEntitiesFtsSegmented(
  useJieba: boolean,
  opts: FtsRebuildOptions,
): Promise<number> {
  const onlyMissing = opts.onlyMissing ?? false;
  const total = useJieba ? await countEntitiesSegmentedTargets(onlyMissing) : 0;
  if (useJieba) {
    report(opts.onProgress, "entities_segmented", "entities", 0, total);
  }
  if (!useJieba || total === 0) return 0;

  const db = getDb();
  let updated = 0;
  let lastId = 0;

  for (;;) {
    const baseConditions = [
      drizzleSql`length(btrim(
        coalesce(${entities.title}, '') || ' ' ||
        coalesce(${entities.summary}, '') || ' ' ||
        coalesce(${entities.content}, '')
      )) > 0`,
    ];
    if (onlyMissing) {
      baseConditions.push(drizzleSql`nullif(btrim(${entities.fts_segmented}), '') IS NULL`);
    }
    const cursorCond = entityIdCursorCondition(onlyMissing, lastId);
    if (cursorCond) baseConditions.push(cursorCond);

    const rows = await db
      .select({
        id: entities.id,
        title: entities.title,
        summary: entities.summary,
        content: entities.content,
        body: entities.body,
        primary_component: entities.primary_component,
      })
      .from(entities)
      .where(and(...baseConditions))
      .orderBy(asc(entities.id))
      .limit(REBUILD_DB_PAGE_SIZE);
    if (rows.length === 0) break;

    for (const row of rows) {
      const indexText = entitySearchTextForWrite({
        title: row.title,
        summary: row.summary,
        content: row.content,
        body: (row.body ?? {}) as Record<string, unknown>,
        primary_component: row.primary_component,
      });
      const fts_segmented = indexText.trim() ? await segmentForFts(indexText) : null;
      await db.update(entities).set({ fts_segmented }).where(eq(entities.id, row.id));
      updated += 1;
      report(opts.onProgress, "entities_segmented", "entities", updated, total);
      lastId = row.id;
    }

    if (!onlyMissing && rows.length < REBUILD_DB_PAGE_SIZE) break;
  }

  return updated;
}

/** Full refresh fts_segmented per cjk.enabled and vectors per embedding config */
export async function rebuildAllFtsSegments(
  opts: FtsRebuildOptions = {},
): Promise<FtsRebuildResult> {
  const useJieba = isCjkJiebaEnabled(getActiveRuntimeConfig().data);
  const semantic_memory = await rebuildSemanticMemoryFtsSegmented(useJieba, opts);
  const messagesCount = await rebuildMessagesFtsSegmented(useJieba, opts);
  const limbic_memory = await rebuildLimbicMemoryFtsSegmented(useJieba, opts);
  const autobiographical_memory = await rebuildAutobiographicalMemoryFtsSegmented(useJieba, opts);
  const entitiesCount = await rebuildEntitiesFtsSegmented(useJieba, opts);

  const embedding_enabled =
    isEmbeddingEnabled(getActiveRuntimeConfig().data) && getEmbedTextFn() != null;
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

  return omitUndefined({
    tables: {
      semantic_memory,
      messages: messagesCount,
      limbic_memory,
      autobiographical_memory,
      entities: entitiesCount,
    },
    cjk_enabled: useJieba,
    embedding_enabled,
    embeddings,
  });
}

export type { FtsRebuildOptions, FtsRebuildPhase, FtsRebuildProgress } from "./rebuild-types.ts";
