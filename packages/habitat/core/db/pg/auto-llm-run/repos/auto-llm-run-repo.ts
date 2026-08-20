import { and, asc, count, desc, eq, inArray, lt, ne, sql } from "drizzle-orm";
import { randomPublicId } from "@freeanima/shared/util";
import { autoLlmMessages, autoLlmRuns } from "@freeanima/habitat/core/db/schema";
import { omitUndefined } from "@freeanima/habitat/core/util";
import type {
  AutoLlmMessageAppendInput,
  AutoLlmMessageRow,
  AutoLlmRunAppendInput,
  AutoLlmRunCountOpts,
  AutoLlmRunFinishInput,
  AutoLlmRunInsertRunningInput,
  AutoLlmRunListOpts,
  AutoLlmRunRow,
  PurgeStaleAutoLlmRunsOpts,
} from "../types.ts";
import { getDb, type DbTransaction } from "../../client.ts";
import {
  coerceLlmUsageTotals,
  emptyUsageTotals,
  llmUsageSumSelect,
} from "../../utils/llm-usage-sql.ts";
import type { LlmUsageTotals } from "@freeanima/shared/llm-usage";

const OUTPUT_MAX = 10_000;
const ERROR_MAX = 2000;
const ORPHAN_ABORT_ERROR = "栖息地重启，运行中断";

export type AutoLlmRunDbRow = typeof autoLlmRuns.$inferSelect;

export function mapAutoLlmRunRow(raw: AutoLlmRunDbRow): AutoLlmRunRow {
  return {
    id: raw.id,
    run_name: raw.run_name,
    run_kind: raw.run_kind,
    subject_id: raw.subject_id,
    output: raw.output,
    status: raw.status,
    duration_ms: raw.duration_ms,
    max_loop_iterations: raw.max_loop_iterations,
    max_duration_ms: raw.max_duration_ms ?? null,
    error: raw.error,
    metadata: raw.metadata,
    created_at: String(raw.created_at),
    finished_at: mapFinishedAt(raw.finished_at),
  };
}

function mapFinishedAt(value: Date | null | undefined): string | null {
  if (value == null) return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(String(value));
  if (!Number.isFinite(ms) || ms === 0) return null;
  return String(value);
}

function buildListConditions(opts?: AutoLlmRunListOpts | AutoLlmRunCountOpts) {
  const conditions = [];
  const run_kind = opts?.run_kind?.trim();
  if (run_kind) {
    conditions.push(eq(autoLlmRuns.run_kind, run_kind));
  }
  if (opts?.status) {
    conditions.push(eq(autoLlmRuns.status, opts.status));
  }
  return conditions;
}

async function insertMessageRows(
  tx: DbTransaction,
  runId: string,
  msgs: AutoLlmMessageAppendInput[],
): Promise<void> {
  if (msgs.length === 0) return;
  await tx.insert(autoLlmMessages).values(
    msgs.map((m) => ({
      id: m.id ?? randomPublicId(),
      run_id: runId,
      subject_id: m.subject_id,
      pos: m.pos,
      payload: m.payload,
    })),
  );
}

export async function listAutoLlmRuns(opts?: AutoLlmRunListOpts): Promise<AutoLlmRunRow[]> {
  const limit = Math.max(1, Math.min(200, opts?.limit ?? 50));
  const offset = Math.max(0, opts?.offset ?? 0);
  const conditions = buildListConditions(opts);

  const db = getDb();
  const rows = await db
    .select()
    .from(autoLlmRuns)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(
      sql`CASE WHEN ${autoLlmRuns.status} = 'running' THEN 0 ELSE 1 END`,
      desc(autoLlmRuns.created_at),
    )
    .offset(offset)
    .limit(limit);
  return rows.map(mapAutoLlmRunRow);
}

export async function countAutoLlmRuns(opts?: AutoLlmRunCountOpts): Promise<number> {
  const conditions = buildListConditions(opts);
  const db = getDb();
  const rows = await db
    .select({ value: count() })
    .from(autoLlmRuns)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  return rows[0]?.value ?? 0;
}

export async function getAutoLlmRun(id: string): Promise<AutoLlmRunRow | null> {
  const db = getDb();
  const rows = await db.select().from(autoLlmRuns).where(eq(autoLlmRuns.id, id)).limit(1);
  const raw = rows[0];
  return raw ? mapAutoLlmRunRow(raw) : null;
}

export async function listAutoLlmMessages(runId: string): Promise<AutoLlmMessageRow[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(autoLlmMessages)
    .where(eq(autoLlmMessages.run_id, runId))
    .orderBy(asc(autoLlmMessages.pos));
  return rows.map((raw) => ({
    id: raw.id,
    run_id: raw.run_id,
    subject_id: raw.subject_id,
    pos: raw.pos,
    payload: raw.payload,
  }));
}

export async function insertRunningAutoLlmRun(row: AutoLlmRunInsertRunningInput): Promise<void> {
  const created_at = row.created_at ? new Date(row.created_at) : new Date();
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.insert(autoLlmRuns).values({
      id: row.id,
      run_name: row.run_name,
      run_kind: row.run_kind,
      subject_id: row.subject_id,
      output: "",
      status: "running",
      duration_ms: 0,
      max_loop_iterations: row.max_loop_iterations,
      max_duration_ms: row.max_duration_ms ?? null,
      error: null,
      metadata: row.metadata ?? null,
      created_at,
      finished_at: null,
    });
    await insertMessageRows(tx, row.id, row.messages ?? []);
  });
}

export async function appendAutoLlmMessages(
  runId: string,
  msgs: AutoLlmMessageAppendInput[],
): Promise<void> {
  if (msgs.length === 0) return;
  const db = getDb();
  await db.transaction(async (tx) => {
    await insertMessageRows(tx, runId, msgs);
  });
}

export async function finishAutoLlmRun(row: AutoLlmRunFinishInput): Promise<void> {
  const finished_at = row.finished_at ? new Date(row.finished_at) : new Date();
  const db = getDb();
  await db
    .update(autoLlmRuns)
    .set({
      status: row.status,
      output: row.output.slice(0, OUTPUT_MAX),
      duration_ms: row.duration_ms,
      error: row.error != null ? row.error.slice(0, ERROR_MAX) : null,
      finished_at,
    })
    .where(eq(autoLlmRuns.id, row.id));
}

/** 一次插完（测试 / 兼容）；新路径用 insertRunning + append + finish */
export async function appendAutoLlmRun(row: AutoLlmRunAppendInput): Promise<void> {
  await insertRunningAutoLlmRun(
    omitUndefined({
      id: row.id,
      run_name: row.run_name,
      run_kind: row.run_kind,
      subject_id: row.subject_id,
      max_loop_iterations: row.max_loop_iterations,
      max_duration_ms: row.max_duration_ms,
      metadata: row.metadata,
      created_at: row.created_at,
      messages: row.messages,
    }),
  );
  await finishAutoLlmRun(
    omitUndefined({
      id: row.id,
      status: row.status,
      output: row.output,
      duration_ms: row.duration_ms,
      error: row.error,
      finished_at: row.finished_at,
    }),
  );
}

export async function abortOrphanAutoLlmRuns(): Promise<{ aborted: number }> {
  const db = getDb();
  const now = new Date();
  const orphans = await db
    .select({ id: autoLlmRuns.id, created_at: autoLlmRuns.created_at })
    .from(autoLlmRuns)
    .where(eq(autoLlmRuns.status, "running"));
  if (orphans.length === 0) return { aborted: 0 };

  for (const orphan of orphans) {
    const duration_ms = Math.max(0, now.getTime() - orphan.created_at.getTime());
    await db
      .update(autoLlmRuns)
      .set({
        status: "error",
        error: ORPHAN_ABORT_ERROR,
        finished_at: now,
        duration_ms,
      })
      .where(eq(autoLlmRuns.id, orphan.id));
  }
  return { aborted: orphans.length };
}

export async function purgeStaleAutoLlmRuns(
  opts: PurgeStaleAutoLlmRunsOpts,
): Promise<{ deleted: number }> {
  const db = getDb();
  const olderThan = opts.olderThan instanceof Date ? opts.olderThan : new Date(opts.olderThan);
  let deleted = 0;

  const byAge = await db
    .delete(autoLlmRuns)
    .where(
      and(
        ne(autoLlmRuns.status, "running"),
        lt(sql`coalesce(${autoLlmRuns.finished_at}, ${autoLlmRuns.created_at})`, olderThan),
      ),
    )
    .returning({ id: autoLlmRuns.id });
  deleted += byAge.length;

  const perKindKeep = opts.perRunKindKeep ?? 0;
  if (perKindKeep <= 0) return { deleted };

  const kinds = await db.selectDistinct({ run_kind: autoLlmRuns.run_kind }).from(autoLlmRuns);
  for (const { run_kind } of kinds) {
    const keepRows = await db
      .select({ id: autoLlmRuns.id })
      .from(autoLlmRuns)
      .where(and(eq(autoLlmRuns.run_kind, run_kind), ne(autoLlmRuns.status, "running")))
      .orderBy(desc(autoLlmRuns.created_at))
      .limit(perKindKeep);
    const keepIds = new Set(keepRows.map((r) => r.id));

    const allRows = await db
      .select({ id: autoLlmRuns.id, status: autoLlmRuns.status })
      .from(autoLlmRuns)
      .where(eq(autoLlmRuns.run_kind, run_kind));
    const toDelete = allRows
      .filter((r) => r.status !== "running" && !keepIds.has(r.id))
      .map((r) => r.id);
    if (toDelete.length === 0) continue;

    const extra = await db
      .delete(autoLlmRuns)
      .where(inArray(autoLlmRuns.id, toDelete))
      .returning({ id: autoLlmRuns.id });
    deleted += extra.length;
  }

  return { deleted };
}

export async function sumAutoLlmUsageByRunIds(
  runIds: string[],
): Promise<Map<string, LlmUsageTotals>> {
  const out = new Map<string, LlmUsageTotals>();
  if (runIds.length === 0) return out;
  const db = getDb();
  const rows = await db
    .select({
      run_id: autoLlmMessages.run_id,
      ...llmUsageSumSelect(autoLlmMessages.payload),
    })
    .from(autoLlmMessages)
    .where(
      and(
        inArray(autoLlmMessages.run_id, runIds),
        sql`${autoLlmMessages.payload}->>'role' = 'assistant'`,
      ),
    )
    .groupBy(autoLlmMessages.run_id);
  for (const row of rows) {
    out.set(row.run_id, coerceLlmUsageTotals(row));
  }
  return out;
}

export async function sumAutoLlmUsageFiltered(opts?: AutoLlmRunCountOpts): Promise<LlmUsageTotals> {
  const conditions = buildListConditions(opts);
  const db = getDb();
  const rows = await db
    .select(llmUsageSumSelect(autoLlmMessages.payload))
    .from(autoLlmMessages)
    .innerJoin(autoLlmRuns, eq(autoLlmMessages.run_id, autoLlmRuns.id))
    .where(
      and(
        sql`${autoLlmMessages.payload}->>'role' = 'assistant'`,
        ...(conditions.length > 0 ? conditions : []),
      ),
    );
  return coerceLlmUsageTotals(rows[0] ?? {});
}

export async function sumAutoLlmUsageBetween(
  fromIso: string,
  toIso: string,
): Promise<LlmUsageTotals> {
  const db = getDb();
  const rows = await db
    .select(llmUsageSumSelect(autoLlmMessages.payload))
    .from(autoLlmMessages)
    .innerJoin(autoLlmRuns, eq(autoLlmMessages.run_id, autoLlmRuns.id))
    .where(
      and(
        sql`${autoLlmMessages.payload}->>'role' = 'assistant'`,
        sql`${autoLlmRuns.created_at} >= ${fromIso}::timestamptz`,
        sql`${autoLlmRuns.created_at} < ${toIso}::timestamptz`,
      ),
    );
  return coerceLlmUsageTotals(rows[0] ?? {});
}

export function usageOrEmpty(usage: LlmUsageTotals | undefined): LlmUsageTotals {
  return usage ?? emptyUsageTotals();
}
