import { and, count, desc, eq, inArray, lt } from "drizzle-orm";
import { autoLlmRuns } from "@freeanima/core/db/schema";
import type {
  AutoLlmRunAppendInput,
  AutoLlmRunCountOpts,
  AutoLlmRunListOpts,
  AutoLlmRunRow,
  PurgeStaleAutoLlmRunsOpts,
} from "@freeanima/core/repos";
import { formatCstIso } from "@freeanima/core/util";

import { getDb } from "../../client.ts";
import { normalizePgTimestamp } from "../../utils/timestamp.ts";

const INPUT_SUMMARY_MAX = 2000;
const OUTPUT_MAX = 10_000;
const ERROR_MAX = 2000;

export type AutoLlmRunDbRow = typeof autoLlmRuns.$inferSelect;

export function mapAutoLlmRunRow(raw: AutoLlmRunDbRow): AutoLlmRunRow {
  return {
    id: raw.id,
    run_name: raw.run_name,
    run_kind: raw.run_kind,
    input_summary: raw.input_summary,
    output: raw.output,
    status: raw.status,
    duration_ms: raw.duration_ms,
    error: raw.error,
    metadata: raw.metadata as Record<string, unknown> | null,
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
    .where(conditions.length ? and(...conditions) : undefined)
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
    .where(conditions.length ? and(...conditions) : undefined);
  return Number(rows[0]?.value ?? 0);
}

export async function appendAutoLlmRun(row: AutoLlmRunAppendInput): Promise<void> {
  const created_at = row.created_at ?? formatCstIso();
  const finished_at = row.finished_at ?? created_at;
  const db = getDb();
  await db.insert(autoLlmRuns).values({
    id: row.id,
    run_name: row.run_name,
    run_kind: row.run_kind,
    input_summary: row.input_summary.slice(0, INPUT_SUMMARY_MAX),
    output: row.output.slice(0, OUTPUT_MAX),
    status: row.status,
    duration_ms: row.duration_ms,
    error: row.error != null ? row.error.slice(0, ERROR_MAX) : null,
    metadata: row.metadata ?? null,
    created_at: normalizePgTimestamp(new Date(created_at)),
    finished_at: normalizePgTimestamp(new Date(finished_at)),
  });
}

export async function purgeStaleAutoLlmRuns(
  opts: PurgeStaleAutoLlmRunsOpts,
): Promise<{ deleted: number }> {
  const db = getDb();
  const olderThanIso = normalizePgTimestamp(opts.olderThan);
  let deleted = 0;

  const byAge = await db
    .delete(autoLlmRuns)
    .where(lt(autoLlmRuns.finished_at, olderThanIso))
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
    if (!keepIds.length) continue;

    const allRows = await db
      .select({ id: autoLlmRuns.id })
      .from(autoLlmRuns)
      .where(eq(autoLlmRuns.run_kind, run_kind));
    const toDelete = allRows.map((r) => r.id).filter((id) => !keepIds.includes(id));
    if (!toDelete.length) continue;

    const extra = await db
      .delete(autoLlmRuns)
      .where(inArray(autoLlmRuns.id, toDelete))
      .returning({ id: autoLlmRuns.id });
    deleted += extra.length;
  }

  return { deleted };
}
