import { and, count, desc, eq, inArray, lt, asc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { autoLlmRuns, autoLlmMessages } from "@freeanima/habitat/core/db/schema";
import type {
  AutoLlmMessageRow,
  AutoLlmRunAppendInput,
  AutoLlmRunCountOpts,
  AutoLlmRunListOpts,
  AutoLlmRunRow,
  PurgeStaleAutoLlmRunsOpts,
} from "../types.ts";
import { getDb } from "../../client.ts";

const INPUT_SUMMARY_MAX = 2000;
const OUTPUT_MAX = 10_000;
const ERROR_MAX = 2000;

export type AutoLlmRunDbRow = typeof autoLlmRuns.$inferSelect;

export function mapAutoLlmRunRow(raw: AutoLlmRunDbRow): AutoLlmRunRow {
  return {
    id: raw.id,
    run_name: raw.run_name,
    run_kind: raw.run_kind,
    subject_id: raw.subject_id ?? null,
    input_summary: raw.input_summary,
    output: raw.output,
    status: raw.status,
    duration_ms: raw.duration_ms,
    error: raw.error,
    metadata: raw.metadata,
    created_at: String(raw.created_at),
    finished_at: String(raw.finished_at),
  };
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

export async function listAutoLlmRuns(opts?: AutoLlmRunListOpts): Promise<AutoLlmRunRow[]> {
  const limit = Math.max(1, Math.min(200, opts?.limit ?? 50));
  const offset = Math.max(0, opts?.offset ?? 0);
  const conditions = buildListConditions(opts);

  const db = getDb();
  const rows = await db
    .select()
    .from(autoLlmRuns)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(autoLlmRuns.finished_at))
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
    pos: raw.pos,
    payload: raw.payload,
  }));
}

export async function appendAutoLlmRun(row: AutoLlmRunAppendInput): Promise<void> {
  const created_at = row.created_at ? new Date(row.created_at) : new Date();
  const finished_at = row.finished_at ? new Date(row.finished_at) : created_at;
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.insert(autoLlmRuns).values({
      id: row.id,
      run_name: row.run_name,
      run_kind: row.run_kind,
      subject_id: row.subject_id ?? null,
      input_summary: row.input_summary.slice(0, INPUT_SUMMARY_MAX),
      output: row.output.slice(0, OUTPUT_MAX),
      status: row.status,
      duration_ms: row.duration_ms,
      error: row.error != null ? row.error.slice(0, ERROR_MAX) : null,
      metadata: row.metadata ?? null,
      created_at,
      finished_at,
    });
    const msgs = row.messages ?? [];
    if (msgs.length === 0) return;
    await tx.insert(autoLlmMessages).values(
      msgs.map((m) => ({
        id: m.id ?? randomUUID(),
        run_id: row.id,
        pos: m.pos,
        payload: m.payload,
      })),
    );
  });
}

export async function purgeStaleAutoLlmRuns(
  opts: PurgeStaleAutoLlmRunsOpts,
): Promise<{ deleted: number }> {
  const db = getDb();
  const olderThan = opts.olderThan instanceof Date ? opts.olderThan : new Date(opts.olderThan);
  let deleted = 0;

  const byAge = await db
    .delete(autoLlmRuns)
    .where(lt(autoLlmRuns.finished_at, olderThan))
    .returning({ id: autoLlmRuns.id });
  deleted += byAge.length;

  const perKindKeep = opts.perRunKindKeep ?? 0;
  if (perKindKeep <= 0) return { deleted };

  const kinds = await db.selectDistinct({ run_kind: autoLlmRuns.run_kind }).from(autoLlmRuns);
  for (const { run_kind } of kinds) {
    const keepRows = await db
      .select({ id: autoLlmRuns.id })
      .from(autoLlmRuns)
      .where(eq(autoLlmRuns.run_kind, run_kind))
      .orderBy(desc(autoLlmRuns.finished_at))
      .limit(perKindKeep);
    const keepIds = keepRows.map((r) => r.id);
    if (keepIds.length === 0) continue;

    const allRows = await db
      .select({ id: autoLlmRuns.id })
      .from(autoLlmRuns)
      .where(eq(autoLlmRuns.run_kind, run_kind));
    const toDelete = allRows.map((r) => r.id).filter((id) => !keepIds.includes(id));
    if (toDelete.length === 0) continue;

    const extra = await db
      .delete(autoLlmRuns)
      .where(inArray(autoLlmRuns.id, toDelete))
      .returning({ id: autoLlmRuns.id });
    deleted += extra.length;
  }

  return { deleted };
}
