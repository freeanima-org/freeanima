import { sql as drizzleSql } from "drizzle-orm";
import type {
  CronJobBuiltinUpsertInput,
  CronJobCreateInput,
  CronJobRow,
  CronJobUpdateInput,
} from "@freeanima/engine-repos";
import { formatCstIso } from "@freeanima/kernel-util";

import { getDb } from "../../client.ts";
import { mapCronJobRow, type CronJobDbRow } from "../mappers/cron-mapper.ts";

function normalizeStringArray(raw: string[] | undefined | null): string[] {
  if (!raw) return [];
  return raw.map((s) => s.trim()).filter(Boolean);
}

function rowFromDb(raw: CronJobDbRow): CronJobRow {
  return mapCronJobRow(raw);
}

function textArrayLiteral(values: string[]): string {
  if (!values.length) return "'{}'::text[]";
  return `ARRAY[${values.map((v) => sqlLiteral(v)).join(", ")}]::text[]`;
}

function nullableTextArrayLiteral(values: string[] | null | undefined): string {
  if (values == null) return "NULL";
  return textArrayLiteral(normalizeStringArray(values));
}

export async function createCronJob(row: CronJobCreateInput): Promise<void> {
  const now = formatCstIso();
  const created = row.created_at ?? now;
  const updated = row.updated_at ?? created;
  const skills = normalizeStringArray(row.skills);
  const contextFrom = normalizeStringArray(row.context_from);

  const db = getDb();
  await db.execute(
    drizzleSql.raw(`
    INSERT INTO cron_jobs (
      id, name, schedule, prompt, skills, script, no_agent, enabled_toolsets,
      model_provider, model_name, workdir, context_from, deliver, timeout_sec,
      builtin, repeat, run_count, paused, created_at, updated_at, last_run_at, last_output_ref
    ) VALUES (
      ${sqlLiteral(row.id)},
      ${sqlLiteral(row.name)},
      ${sqlLiteral(row.schedule)},
      ${sqlLiteral(row.prompt ?? "")},
      ${textArrayLiteral(skills)},
      ${row.script != null ? sqlLiteral(row.script) : "NULL"},
      ${row.no_agent ?? false},
      ${nullableTextArrayLiteral(row.enabled_toolsets)},
      ${row.model_provider != null ? sqlLiteral(row.model_provider) : "NULL"},
      ${row.model_name != null ? sqlLiteral(row.model_name) : "NULL"},
      ${row.workdir != null ? sqlLiteral(row.workdir) : "NULL"},
      ${textArrayLiteral(contextFrom)},
      ${sqlLiteral(row.deliver ?? "local")},
      ${row.timeout_sec ?? 300},
      ${row.builtin ?? false},
      ${row.repeat ?? null},
      ${row.run_count ?? 0},
      ${row.paused ?? false},
      ${sqlLiteral(created)}::timestamptz,
      ${sqlLiteral(updated)}::timestamptz,
      ${row.last_run_at != null ? `${sqlLiteral(row.last_run_at)}::timestamptz` : "NULL"},
      ${row.last_output_ref != null ? sqlLiteral(row.last_output_ref) : "NULL"}
    )
  `),
  );
}

/** 内置任务 upsert：冲突时仅更新 name/schedule/updated_at；返回 schedule 是否变化 */
export async function upsertBuiltinCronJob(row: CronJobBuiltinUpsertInput): Promise<boolean> {
  const now = formatCstIso();
  const db = getDb();

  const existing = await getCronJob(row.id);
  const scheduleChanged = existing != null && existing.schedule !== row.schedule;

  await db.execute(drizzleSql`
    INSERT INTO cron_jobs (
      id, name, schedule, prompt, no_agent, builtin, deliver, timeout_sec,
      created_at, updated_at
    ) VALUES (
      ${row.id},
      ${row.name},
      ${row.schedule},
      ${row.prompt ?? ""},
      ${row.no_agent ?? true},
      true,
      ${row.deliver ?? "local"},
      ${row.timeout_sec ?? 1800},
      ${now}::timestamptz,
      ${now}::timestamptz
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      schedule = EXCLUDED.schedule,
      updated_at = EXCLUDED.updated_at
  `);

  return scheduleChanged;
}

export async function getCronJob(id: string): Promise<CronJobRow | null> {
  const db = getDb();
  const rows = await db.execute<CronJobDbRow>(drizzleSql`
    SELECT
      id, name, schedule, prompt, skills, script, no_agent, enabled_toolsets,
      model_provider, model_name, workdir, context_from, deliver, timeout_sec,
      builtin, repeat, run_count, paused, created_at, updated_at, last_run_at, last_output_ref
    FROM cron_jobs
    WHERE id = ${id}
    LIMIT 1
  `);
  const row = rows[0];
  return row ? rowFromDb(row) : null;
}

export async function updateCronJob(patch: CronJobUpdateInput): Promise<boolean> {
  const sets: string[] = [];
  sets.push(`updated_at = ${sqlLiteral(patch.updated_at ?? formatCstIso())}::timestamptz`);
  if (patch.name !== undefined) sets.push(`name = ${sqlLiteral(patch.name)}`);
  if (patch.schedule !== undefined) sets.push(`schedule = ${sqlLiteral(patch.schedule)}`);
  if (patch.prompt !== undefined) sets.push(`prompt = ${sqlLiteral(patch.prompt)}`);
  if (patch.skills !== undefined) {
    sets.push(`skills = ${textArrayLiteral(normalizeStringArray(patch.skills))}`);
  }
  if (patch.script !== undefined) {
    sets.push(patch.script == null ? "script = NULL" : `script = ${sqlLiteral(patch.script)}`);
  }
  if (patch.no_agent !== undefined) sets.push(`no_agent = ${patch.no_agent}`);
  if (patch.enabled_toolsets !== undefined) {
    sets.push(`enabled_toolsets = ${nullableTextArrayLiteral(patch.enabled_toolsets)}`);
  }
  if (patch.model_provider !== undefined) {
    sets.push(
      patch.model_provider == null
        ? "model_provider = NULL"
        : `model_provider = ${sqlLiteral(patch.model_provider)}`,
    );
  }
  if (patch.model_name !== undefined) {
    sets.push(
      patch.model_name == null
        ? "model_name = NULL"
        : `model_name = ${sqlLiteral(patch.model_name)}`,
    );
  }
  if (patch.workdir !== undefined) {
    sets.push(patch.workdir == null ? "workdir = NULL" : `workdir = ${sqlLiteral(patch.workdir)}`);
  }
  if (patch.context_from !== undefined) {
    sets.push(`context_from = ${textArrayLiteral(normalizeStringArray(patch.context_from))}`);
  }
  if (patch.deliver !== undefined) sets.push(`deliver = ${sqlLiteral(patch.deliver)}`);
  if (patch.timeout_sec !== undefined) sets.push(`timeout_sec = ${patch.timeout_sec}`);
  if (patch.repeat !== undefined) {
    sets.push(patch.repeat == null ? "repeat = NULL" : `repeat = ${patch.repeat}`);
  }
  if (patch.run_count !== undefined) sets.push(`run_count = ${patch.run_count}`);
  if (patch.paused !== undefined) sets.push(`paused = ${patch.paused}`);
  if (patch.last_run_at !== undefined) {
    sets.push(
      patch.last_run_at == null
        ? "last_run_at = NULL"
        : `last_run_at = ${sqlLiteral(patch.last_run_at)}::timestamptz`,
    );
  }
  if (patch.last_output_ref !== undefined) {
    sets.push(
      patch.last_output_ref == null
        ? "last_output_ref = NULL"
        : `last_output_ref = ${sqlLiteral(patch.last_output_ref)}`,
    );
  }

  if (sets.length === 1) return true;

  const db = getDb();
  const updated = await db.execute<{ id: string }>(
    drizzleSql.raw(`
    UPDATE cron_jobs SET ${sets.join(", ")}
    WHERE id = ${sqlLiteral(patch.id)}
    RETURNING id
  `),
  );
  return updated.length > 0;
}

export async function deleteCronJob(id: string): Promise<boolean> {
  const db = getDb();
  const deleted = await db.execute<{ id: string }>(drizzleSql`
    DELETE FROM cron_jobs WHERE id = ${id} RETURNING id
  `);
  return deleted.length > 0;
}

export async function listAllCronJobs(): Promise<CronJobRow[]> {
  const db = getDb();
  const rows = await db.execute<CronJobDbRow>(drizzleSql`
    SELECT
      id, name, schedule, prompt, skills, script, no_agent, enabled_toolsets,
      model_provider, model_name, workdir, context_from, deliver, timeout_sec,
      builtin, repeat, run_count, paused, created_at, updated_at, last_run_at, last_output_ref
    FROM cron_jobs
    ORDER BY created_at ASC
  `);
  return rows.map(rowFromDb);
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
