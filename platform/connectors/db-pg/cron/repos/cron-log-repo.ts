import { and, desc, eq, inArray } from "drizzle-orm";
import { cronLog } from "@freeanima/core/db/schema";
import type { CronLogAppendInput, CronLogListOpts, CronLogRow } from "@freeanima/core/repos";

import { getDb } from "../../client.ts";

export type CronLogDbRow = typeof cronLog.$inferSelect;

export function mapRow(raw: CronLogDbRow): CronLogRow {
  return {
    id: raw.id,
    job_id: raw.job_id,
    run_count: raw.run_count,
    ok: raw.ok,
    finished_at:
      raw.finished_at instanceof Date ? raw.finished_at.toISOString() : String(raw.finished_at),
    output: raw.output as Record<string, unknown> | null,
    output_text: raw.output_text,
    error: raw.error,
  };
}

export async function appendCronLog(row: CronLogAppendInput): Promise<void> {
  const finished_at = row.finished_at ? new Date(row.finished_at) : new Date();
  const output_text = row.output_text != null ? row.output_text.slice(0, 10_000) : null;
  const errorText = row.error != null ? row.error.slice(0, 2000) : null;

  const db = getDb();
  await db
    .insert(cronLog)
    .values({
      job_id: row.job_id,
      run_count: row.run_count,
      ok: row.ok,
      finished_at,
      output: row.output ?? null,
      output_text,
      error: errorText,
    })
    .onConflictDoUpdate({
      target: [cronLog.job_id, cronLog.run_count],
      set: {
        ok: row.ok,
        finished_at,
        output: row.output ?? null,
        output_text,
        error: errorText,
      },
    });
}

export async function listCronLogs(opts?: CronLogListOpts): Promise<CronLogRow[]> {
  const limit = Math.max(1, Math.min(200, opts?.limit ?? 50));
  const offset = Math.max(0, opts?.offset ?? 0);

  const jobIds = opts?.job_ids?.length
    ? opts.job_ids.map((s) => s.trim()).filter(Boolean)
    : opts?.job_id
      ? [opts.job_id.trim()].filter(Boolean)
      : [];

  const conditions = [];
  if (jobIds.length === 1) {
    conditions.push(eq(cronLog.job_id, jobIds[0]!));
  } else if (jobIds.length > 1) {
    conditions.push(inArray(cronLog.job_id, jobIds));
  }
  if (opts?.ok !== undefined) {
    conditions.push(eq(cronLog.ok, opts.ok));
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(cronLog)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(cronLog.finished_at))
    .offset(offset)
    .limit(limit);
  return rows.map(mapRow);
}
