import { and, asc, eq, gt, sql as drizzleSql, type SQL } from "drizzle-orm";
import {
  entities,
  messages,
  searchDocuments,
  SEMANTIC_MEMORY_COMPONENT,
} from "@freeanima/host/core/db/schema";
import { entitySearchTextForWrite } from "@freeanima/host/core/db/schema/entity";

import { getActiveRuntimeConfig, isEmbeddingEnabled } from "@freeanima/host/core/config";
import { isCjkJiebaEnabled } from "@freeanima/host/core/config/cjk-config";
import { omitUndefined } from "@freeanima/host/core/util";
import { logPgComponent } from "../log.ts";

import { EMBEDDING_QUEUE_FLUSH_THRESHOLD } from "../embedding/batch-pack.ts";
import { embedAndStoreJobsResult } from "../embedding/embed-jobs.ts";
import { getEmbedTextFn } from "../embedding/runtime.ts";
import { getDb } from "../client.ts";
import { segmentForFts } from "./segment.ts";
import type { FtsRebuildOptions, FtsRebuildPhase } from "./rebuild-types.ts";
import { entityToSearchDoc, messageToSearchDoc } from "../search/docs-from-business.ts";
import { getSearchBackend, tryGetSearchBackend } from "../search/runtime.ts";
import { createPgSearchIndexBackend } from "../search/pg-search-index/backend.ts";

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

const EMBED_REBUILD_MAX_ATTEMPTS = 3;
const EMBED_REBUILD_RETRY_BASE_MS = 750;

type EmbedRebuildFailure = {
  phase: FtsRebuildPhase;
  id: string;
  reason: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

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

function missingSegmentedCondition(): SQL {
  return drizzleSql`(${searchDocuments.doc_key} IS NULL OR nullif(btrim(${searchDocuments.fts_segmented}), '') IS NULL)`;
}

function missingEmbeddingCondition(): SQL {
  return drizzleSql`(${searchDocuments.doc_key} IS NULL OR ${searchDocuments.embedding} IS NULL)`;
}

function entitySearchJoin() {
  return and(
    eq(searchDocuments.resource, "entity"),
    drizzleSql`${searchDocuments.source_id} = ${entities.id}::text`,
  );
}

function messageSearchJoin() {
  return and(eq(searchDocuments.resource, "message"), eq(searchDocuments.source_id, messages.id));
}

async function ensureSearchBackend() {
  if (!tryGetSearchBackend()) {
    // Rebuild may run before bind in tests; default to side-table backend.
    const { registerSearchBackend } = await import("../search/runtime.ts");
    registerSearchBackend(createPgSearchIndexBackend());
  }
  return getSearchBackend();
}

/** Embed one row with retries; on persistent failure record and skip (resume can retry). */
async function embedRebuildRow(
  phase: FtsRebuildPhase,
  job: {
    kind: "semantic_memory" | "message" | "limbic_memory" | "autobiographical_memory" | "entity";
    id: string;
    content: string;
  },
  failures: EmbedRebuildFailure[],
  opts: FtsRebuildOptions = {},
): Promise<number> {
  const trimmed = job.content.trim();
  if (!trimmed) {
    log.warn("embedding rebuild skipping empty content", { phase, row_id: job.id });
    return 0;
  }

  const maxAttempts = Math.max(1, opts.embedRetryAttempts ?? EMBED_REBUILD_MAX_ATTEMPTS);
  const retryBaseMs = Math.max(0, opts.embedRetryBaseMs ?? EMBED_REBUILD_RETRY_BASE_MS);

  let lastReason = "check API, dimensions, config";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await embedAndStoreJobsResult([{ ...job, content: trimmed }]);
    if (result.stored > 0) return result.stored;
    lastReason = result.emptyReason?.trim() || lastReason;
    if (attempt < maxAttempts) {
      log.warn("embedding rebuild row retry", {
        phase,
        row_id: job.id,
        attempt,
        empty_reason: lastReason,
      });
      if (retryBaseMs > 0) await sleep(retryBaseMs * attempt);
    }
  }

  log.error("embedding rebuild row skipped after retries", {
    phase,
    row_id: job.id,
    empty_reason: lastReason,
    attempts: maxAttempts,
  });
  failures.push({ phase, id: job.id, reason: lastReason });
  return 0;
}

async function countSemanticMemorySegmentedTargets(onlyMissing: boolean): Promise<number> {
  const db = getDb();
  const conditions = [
    semanticMemoryPrimaryCondition(),
    drizzleSql`length(btrim(${entities.content})) > 0`,
  ];
  if (onlyMissing) conditions.push(missingSegmentedCondition());
  const rows = await db
    .select({ n: drizzleSql<number>`count(*)::int` })
    .from(entities)
    .leftJoin(searchDocuments, entitySearchJoin())
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
  if (onlyMissing) conditions.push(missingSegmentedCondition());
  const rows = await db
    .select({ n: drizzleSql<number>`count(*)::int` })
    .from(entities)
    .leftJoin(searchDocuments, entitySearchJoin())
    .where(and(...conditions));
  return Number(rows[0]?.n ?? 0);
}

async function countMessagesSegmentedTargets(onlyMissing: boolean): Promise<number> {
  const db = getDb();
  const conditions = [
    drizzleSql`(${messages.payload})->>'role' IN ('user', 'assistant')`,
    drizzleSql`length(btrim(coalesce(${messages.payload}->>'content', ''))) > 0`,
  ];
  if (onlyMissing) conditions.push(missingSegmentedCondition());
  const rows = await db
    .select({ n: drizzleSql<number>`count(*)::int` })
    .from(messages)
    .leftJoin(searchDocuments, messageSearchJoin())
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
  if (onlyMissing) conditions.push(missingEmbeddingCondition());
  const rows = await db
    .select({ n: drizzleSql<number>`count(*)::int` })
    .from(entities)
    .leftJoin(searchDocuments, entitySearchJoin())
    .where(and(...conditions));
  return Number(rows[0]?.n ?? 0);
}

async function countMessagesEmbeddingTargets(onlyMissing: boolean): Promise<number> {
  const db = getDb();
  const conditions = [
    drizzleSql`(${messages.payload})->>'role' IN ('user', 'assistant')`,
    drizzleSql`length(btrim(coalesce(${messages.payload}->>'content', ''))) > 0`,
  ];
  if (onlyMissing) conditions.push(missingEmbeddingCondition());
  const rows = await db
    .select({ n: drizzleSql<number>`count(*)::int` })
    .from(messages)
    .leftJoin(searchDocuments, messageSearchJoin())
    .where(and(...conditions));
  return Number(rows[0]?.n ?? 0);
}

async function countEntitiesEmbeddingTargets(onlyMissing: boolean): Promise<number> {
  const db = getDb();
  const conditions = [
    drizzleSql`length(btrim(
      coalesce(${entities.title}, '') || ' ' ||
      coalesce(${entities.summary}, '') || ' ' ||
      coalesce(${entities.content}, '')
    )) > 0`,
  ];
  if (onlyMissing) conditions.push(missingEmbeddingCondition());
  const rows = await db
    .select({ n: drizzleSql<number>`count(*)::int` })
    .from(entities)
    .leftJoin(searchDocuments, entitySearchJoin())
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

  const backend = await ensureSearchBackend();
  const db = getDb();
  let updated = 0;
  let lastId = 0;

  for (;;) {
    const baseConditions = [
      semanticMemoryPrimaryCondition(),
      drizzleSql`length(btrim(${entities.content})) > 0`,
    ];
    if (onlyMissing) baseConditions.push(missingSegmentedCondition());
    if (lastId) baseConditions.push(gt(entities.id, lastId));

    const rows = await db
      .select({
        id: entities.id,
        world_id: entities.world_id,
        primary_component: entities.primary_component,
        title: entities.title,
        summary: entities.summary,
        content: entities.content,
        deleted_at: entities.deleted_at,
      })
      .from(entities)
      .leftJoin(searchDocuments, entitySearchJoin())
      .where(and(...baseConditions))
      .orderBy(asc(entities.id))
      .limit(REBUILD_DB_PAGE_SIZE);
    if (rows.length === 0) break;

    for (const row of rows) {
      const fts_segmented = await segmentForFts(row.content);
      await backend.upsert([
        entityToSearchDoc({
          id: row.id,
          world_id: row.world_id,
          primary_component: row.primary_component,
          title: row.title,
          summary: row.summary,
          content: row.content,
          deleted_at: row.deleted_at,
          fts_segmented,
        }),
      ]);
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

  const backend = await ensureSearchBackend();
  const db = getDb();
  let updated = 0;
  let lastId = "";

  for (;;) {
    const baseConditions = [
      drizzleSql`(${messages.payload})->>'role' IN ('user', 'assistant')`,
      drizzleSql`length(btrim(coalesce(${messages.payload}->>'content', ''))) > 0`,
    ];
    if (onlyMissing) baseConditions.push(missingSegmentedCondition());
    if (lastId) baseConditions.push(gt(messages.id, lastId));

    const rows = await db
      .select({
        id: messages.id,
        conversation_id: messages.conversation_id,
        role: drizzleSql<string>`${messages.payload}->>'role'`,
        content: drizzleSql<string | null>`${messages.payload}->>'content'`,
      })
      .from(messages)
      .leftJoin(searchDocuments, messageSearchJoin())
      .where(and(...baseConditions))
      .orderBy(asc(messages.id))
      .limit(REBUILD_DB_PAGE_SIZE);
    if (rows.length === 0) break;

    for (const row of rows) {
      const content = row.content ?? "";
      const fts_segmented = content ? await segmentForFts(content) : null;
      await backend.upsert([
        messageToSearchDoc({
          id: row.id,
          conversation_id: row.conversation_id,
          role: row.role,
          content,
          fts_segmented,
        }),
      ]);
      updated += 1;
      report(opts.onProgress, "messages_segmented", "messages", updated, total);
      lastId = row.id;
    }

    if (!onlyMissing && rows.length < REBUILD_DB_PAGE_SIZE) break;
  }

  return updated;
}

async function rebuildSemanticMemoryEmbeddings(
  opts: FtsRebuildOptions,
  failures: EmbedRebuildFailure[],
): Promise<number> {
  if (!getEmbedTextFn()) return 0;

  const onlyMissing = opts.onlyMissing ?? false;
  const total = await countSemanticMemoryEmbeddingTargets(onlyMissing);
  report(opts.onProgress, "semantic_memory_embedding", "semantic_memory", 0, total);
  if (total === 0) return 0;

  await ensureSearchBackend();
  const db = getDb();
  let updated = 0;
  let lastId = 0;

  for (;;) {
    const baseConditions = [
      semanticMemoryPrimaryCondition(),
      semanticMemoryActiveCondition(),
      drizzleSql`length(btrim(${entities.content})) > 0`,
    ];
    if (onlyMissing) baseConditions.push(missingEmbeddingCondition());
    if (lastId) baseConditions.push(gt(entities.id, lastId));

    const rows = await db
      .select({ id: entities.id, content: entities.content })
      .from(entities)
      .leftJoin(searchDocuments, entitySearchJoin())
      .where(and(...baseConditions))
      .orderBy(asc(entities.id))
      .limit(REBUILD_EMBEDDING_PAGE_SIZE);
    if (rows.length === 0) break;

    const row = rows[0];
    if (!row) break;
    const [full] = await db
      .select({
        id: entities.id,
        world_id: entities.world_id,
        primary_component: entities.primary_component,
        title: entities.title,
        summary: entities.summary,
        content: entities.content,
        deleted_at: entities.deleted_at,
      })
      .from(entities)
      .where(eq(entities.id, row.id))
      .limit(1);
    if (full) {
      await getSearchBackend().upsert([entityToSearchDoc(full)]);
    }
    const stored = await embedRebuildRow(
      "semantic_memory_embedding",
      {
        kind: "semantic_memory",
        id: String(row.id),
        content: row.content,
      },
      failures,
      opts,
    );
    updated += stored;
    report(opts.onProgress, "semantic_memory_embedding", "semantic_memory", updated, total);
    lastId = row.id;
  }

  return updated;
}

async function rebuildMessagesEmbeddings(
  opts: FtsRebuildOptions,
  failures: EmbedRebuildFailure[],
): Promise<number> {
  if (!getEmbedTextFn()) return 0;

  const onlyMissing = opts.onlyMissing ?? false;
  const total = await countMessagesEmbeddingTargets(onlyMissing);
  report(opts.onProgress, "messages_embedding", "messages", 0, total);
  if (total === 0) return 0;

  await ensureSearchBackend();
  const db = getDb();
  let updated = 0;
  let lastId = "";

  for (;;) {
    const baseConditions = [
      drizzleSql`(${messages.payload})->>'role' IN ('user', 'assistant')`,
      drizzleSql`length(btrim(coalesce(${messages.payload}->>'content', ''))) > 0`,
    ];
    if (onlyMissing) baseConditions.push(missingEmbeddingCondition());
    if (lastId) baseConditions.push(gt(messages.id, lastId));

    const rows = await db
      .select({
        id: messages.id,
        conversation_id: messages.conversation_id,
        role: drizzleSql<string>`${messages.payload}->>'role'`,
        content: drizzleSql<string | null>`${messages.payload}->>'content'`,
      })
      .from(messages)
      .leftJoin(searchDocuments, messageSearchJoin())
      .where(and(...baseConditions))
      .orderBy(asc(messages.id))
      .limit(REBUILD_EMBEDDING_PAGE_SIZE);
    if (rows.length === 0) break;

    const row = rows[0];
    if (!row) break;
    await getSearchBackend().upsert([
      messageToSearchDoc({
        id: row.id,
        conversation_id: row.conversation_id,
        role: row.role,
        content: row.content ?? "",
      }),
    ]);
    const stored = await embedRebuildRow(
      "messages_embedding",
      {
        kind: "message",
        id: row.id,
        content: row.content ?? "",
      },
      failures,
      opts,
    );
    updated += stored;
    report(opts.onProgress, "messages_embedding", "messages", updated, total);
    lastId = row.id;
  }

  return updated;
}

async function rebuildEntitiesEmbeddings(
  opts: FtsRebuildOptions,
  failures: EmbedRebuildFailure[],
): Promise<number> {
  if (!getEmbedTextFn()) return 0;

  const onlyMissing = opts.onlyMissing ?? false;
  const total = await countEntitiesEmbeddingTargets(onlyMissing);
  report(opts.onProgress, "entities_embedding", "entities", 0, total);
  if (total === 0) return 0;

  await ensureSearchBackend();
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
    if (onlyMissing) baseConditions.push(missingEmbeddingCondition());
    if (lastId) baseConditions.push(gt(entities.id, lastId));

    const rows = await db
      .select({
        id: entities.id,
        world_id: entities.world_id,
        primary_component: entities.primary_component,
        title: entities.title,
        summary: entities.summary,
        content: entities.content,
        body: entities.body,
        deleted_at: entities.deleted_at,
      })
      .from(entities)
      .leftJoin(searchDocuments, entitySearchJoin())
      .where(and(...baseConditions))
      .orderBy(asc(entities.id))
      .limit(REBUILD_EMBEDDING_PAGE_SIZE);
    if (rows.length === 0) break;

    const row = rows[0];
    if (!row) break;

    const indexText = entitySearchTextForWrite({
      title: row.title,
      summary: row.summary,
      content: row.content,
      body: (row.body ?? {}) as Record<string, unknown>,
      primary_component: row.primary_component,
    });
    await getSearchBackend().upsert([
      entityToSearchDoc({
        id: row.id,
        world_id: row.world_id,
        primary_component: row.primary_component,
        title: row.title,
        summary: row.summary,
        content: row.content,
        deleted_at: row.deleted_at,
      }),
    ]);
    const stored = await embedRebuildRow(
      "entities_embedding",
      {
        kind: "entity",
        id: String(row.id),
        content: indexText,
      },
      failures,
      opts,
    );
    updated += stored;
    report(opts.onProgress, "entities_embedding", "entities", updated, total);
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

  const backend = await ensureSearchBackend();
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
    if (onlyMissing) baseConditions.push(missingSegmentedCondition());
    if (lastId) baseConditions.push(gt(entities.id, lastId));

    const rows = await db
      .select({
        id: entities.id,
        world_id: entities.world_id,
        title: entities.title,
        summary: entities.summary,
        content: entities.content,
        body: entities.body,
        primary_component: entities.primary_component,
        deleted_at: entities.deleted_at,
      })
      .from(entities)
      .leftJoin(searchDocuments, entitySearchJoin())
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
      await backend.upsert([
        entityToSearchDoc({
          id: row.id,
          world_id: row.world_id,
          primary_component: row.primary_component,
          title: row.title,
          summary: row.summary,
          content: row.content,
          deleted_at: row.deleted_at,
          fts_segmented,
        }),
      ]);
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
  const embedding_failures: EmbedRebuildFailure[] = [];
  if (embedding_enabled) {
    const smEmb = await rebuildSemanticMemoryEmbeddings(opts, embedding_failures);
    const msgEmb = await rebuildMessagesEmbeddings(opts, embedding_failures);
    const entitiesEmb = await rebuildEntitiesEmbeddings(opts, embedding_failures);
    const lmEmb = await rebuildLimbicMemoryEmbeddings(opts);
    const abEmb = await rebuildAutobiographicalMemoryEmbeddings(opts);
    embeddings = {
      semantic_memory: smEmb,
      messages: msgEmb,
      entities: entitiesEmb,
      limbic_memory: lmEmb,
      autobiographical_memory: abEmb,
    };
  }

  if (embedding_failures.length > 0) {
    const sample = embedding_failures
      .slice(0, 3)
      .map((f) => `${f.phase} ${f.id}: ${f.reason}`)
      .join("; ");
    throw new Error(
      `${embedding_failures.length} embedding failure(s) after retries (e.g. ${sample}); click resume to retry remaining`,
    );
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
