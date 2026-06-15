import { and, desc, eq, inArray } from "drizzle-orm";
import { cronLog } from "@freeanima/core/db/schema";
import type { CronLogAppendInput, CronLogListOpts, CronLogRow } from "@freeanima/core/repos";
import { formatCstIso } from "@freeanima/core/util";

import { getDb } from "../../client.ts";

export type CronLogDbRow = typeof cronLog.$inferSelect;

export function mapRow(raw: CronLogDbRow): CronLogRow {
  return {
    id: raw.id,
    job_id: raw.jobId,
    run_count: raw.runCount,
    ok: raw.ok,
    finished_at: String(raw.finishedAt),
    output: raw.output as Record<string, unknown> | null,
    output_text: raw.outputText,
    error: raw.error,
  };
}

export async function appendCronLog(row: CronLogAppendInput): Promise<void> {
  const finishedAt = row.finished_at ?? formatCstIso();
  const outputText = row.output_text != null ? row.output_text.slice(0, 10_000) : null;
  const errorText = row.error != null ? row.error.slice(0, 2000) : null;

  const db = getDb();
  await db
    .insert(cronLog)
    .values({
      jobId: row.job_id,
      runCount: row.run_count,
      ok: row.ok,
      finishedAt,
      output: row.output ?? null,
      outputText,
      error: errorText,
    })
    .onConflictDoUpdate({
      target: [cronLog.jobId, cronLog.runCount],
      set: {
        ok: row.ok,
        finishedAt,
        output: row.output ?? null,
        outputText,
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
    conditions.push(eq(cronLog.jobId, jobIds[0]!));
  } else if (jobIds.length > 1) {
    conditions.push(inArray(cronLog.jobId, jobIds));
  }
  if (opts?.ok !== undefined) {
    conditions.push(eq(cronLog.ok, opts.ok));
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(cronLog)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(cronLog.finishedAt))
    .offset(offset)
    .limit(limit);
  return rows.map(mapRow);
}
