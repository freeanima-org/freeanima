import { sql as drizzleSql } from "drizzle-orm";
import type { CronLogAppendInput, CronLogListOpts, CronLogRow } from "@freeanima/storage-repos";
import { formatCstIso } from "@freeanima/storage-util";

import { getDb } from "../../client.ts";
import { pgSqlLiteral, pgTextArrayLiteral } from "../../utils/pg-sql.ts";

type CronLogDbRow = {
  id: number | bigint;
  job_id: string;
  run_count: number;
  ok: boolean;
  finished_at: string | Date;
  output: Record<string, unknown> | null;
  output_text: string | null;
  error: string | null;
};

export function mapRow(raw: CronLogDbRow): CronLogRow {
  return {
    id: typeof raw.id === "bigint" ? Number(raw.id) : raw.id,
    job_id: raw.job_id,
    run_count: raw.run_count,
    ok: raw.ok,
    finished_at:
      raw.finished_at instanceof Date ? raw.finished_at.toISOString() : String(raw.finished_at),
    output: raw.output,
    output_text: raw.output_text,
    error: raw.error,
  };
}

function jsonLiteral(value: Record<string, unknown> | null | undefined): string {
  if (!value) return "NULL";
  return `${pgSqlLiteral(JSON.stringify(value))}::jsonb`;
}

export async function appendCronLog(row: CronLogAppendInput): Promise<void> {
  const finishedAt = row.finished_at ?? formatCstIso();
  const outputText =
    row.output_text != null ? pgSqlLiteral(row.output_text.slice(0, 10_000)) : "NULL";
  const errorText = row.error != null ? pgSqlLiteral(row.error.slice(0, 2000)) : "NULL";

  const db = getDb();
  await db.execute(
    drizzleSql.raw(`
    INSERT INTO cron_log (job_id, run_count, ok, finished_at, output, output_text, error)
    VALUES (
      ${pgSqlLiteral(row.job_id)},
      ${row.run_count},
      ${row.ok},
      ${pgSqlLiteral(finishedAt)}::timestamptz,
      ${jsonLiteral(row.output ?? null)},
      ${outputText},
      ${errorText}
    )
    ON CONFLICT (job_id, run_count) DO UPDATE SET
      ok = EXCLUDED.ok,
      finished_at = EXCLUDED.finished_at,
      output = EXCLUDED.output,
      output_text = EXCLUDED.output_text,
      error = EXCLUDED.error
  `),
  );
}

export async function listCronLogs(opts?: CronLogListOpts): Promise<CronLogRow[]> {
  const limit = Math.max(1, Math.min(200, opts?.limit ?? 50));
  const offset = Math.max(0, opts?.offset ?? 0);

  const jobIds = opts?.job_ids?.length
    ? opts.job_ids.map((s) => s.trim()).filter(Boolean)
    : opts?.job_id
      ? [opts.job_id.trim()].filter(Boolean)
      : [];

  const jobFilter =
    jobIds.length === 0
      ? ""
      : jobIds.length === 1
        ? `AND job_id = ${pgSqlLiteral(jobIds[0]!)}`
        : `AND job_id = ANY(${pgTextArrayLiteral(jobIds)})`;

  const okFilter = opts?.ok === undefined ? "" : `AND ok = ${opts.ok}`;

  const db = getDb();
  const rows = await db.execute<CronLogDbRow>(
    drizzleSql.raw(`
    SELECT id, job_id, run_count, ok, finished_at, output, output_text, error
    FROM cron_log
    WHERE true
    ${jobFilter}
    ${okFilter}
    ORDER BY finished_at DESC
    OFFSET ${offset}
    LIMIT ${limit}
  `),
  );
  return rows.map(mapRow);
}
