import { asc, eq } from "drizzle-orm";
import { cronJobs } from "@freeanima/host/core/db/schema";
import type {
  CronJobBuiltinUpsertInput,
  CronJobCreateInput,
  CronJobRow,
  CronJobUpdateInput,
} from "../types.ts";

import { getDb } from "../../client.ts";

function normalizeStringArray(raw: string[] | undefined | null): string[] {
  if (!raw) return [];
  return raw.map((s) => s.trim()).filter(Boolean);
}

function coerceDate(value: Date | string | undefined, fallback = new Date()): Date {
  if (value instanceof Date) return value;
  if (value == null) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export async function createCronJob(row: CronJobCreateInput): Promise<void> {
  const now = new Date();
  const created = row.created_at ?? now;
  const updated = row.updated_at ?? created;
  const db = getDb();
  await db.insert(cronJobs).values({
    id: row.id,
    name: row.name,
    schedule: row.schedule,
    prompt: row.prompt ?? "",
    skills: normalizeStringArray(row.skills),
    allowed_tools: normalizeStringArray(row.allowed_tools),
    denied_tools: normalizeStringArray(row.denied_tools),
    script: row.script ?? null,
    no_agent: row.no_agent ?? false,
    model_provider: row.model_provider ?? null,
    model_name: row.model_name ?? null,
    workdir: row.workdir ?? null,
    context_from: normalizeStringArray(row.context_from),
    timeout_sec: row.timeout_sec ?? 300,
    builtin: row.builtin ?? false,
    repeat: row.repeat ?? null,
    run_count: row.run_count ?? 0,
    paused: row.paused ?? false,
    created_at: coerceDate(created, now),
    updated_at: coerceDate(updated, now),
    last_run_at: row.last_run_at ?? null,
    last_output_ref: row.last_output_ref ?? null,
    notify_on_success: row.notify_on_success ?? false,
  });
}

/** Built-in job upsert: on conflict only updates name/schedule/updated_at; returns whether schedule changed */
export async function upsertBuiltinCronJob(row: CronJobBuiltinUpsertInput): Promise<boolean> {
  const now = new Date();
  const db = getDb();

  const existing = await getCronJob(row.id);
  const scheduleChanged = existing != null && existing.schedule !== row.schedule;

  await db
    .insert(cronJobs)
    .values({
      id: row.id,
      name: row.name,
      schedule: row.schedule,
      prompt: row.prompt ?? "",
      no_agent: row.no_agent ?? true,
      builtin: true,
      timeout_sec: row.timeout_sec ?? 1800,
      created_at: now,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: cronJobs.id,
      set: {
        name: row.name,
        schedule: row.schedule,
        // 纠偏：旧行可能 builtin=false / no_agent 被改写，导致 no_agent 无 handler 失败
        builtin: true,
        no_agent: row.no_agent ?? true,
        timeout_sec: row.timeout_sec ?? 1800,
        updated_at: now,
      },
    });

  return scheduleChanged;
}

export async function getCronJob(id: string): Promise<CronJobRow | null> {
  const db = getDb();
  const rows = await db.select().from(cronJobs).where(eq(cronJobs.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateCronJob(patch: CronJobUpdateInput): Promise<boolean> {
  const trimmed = patch.id.trim();
  if (!trimmed) return false;

  const set: Partial<typeof cronJobs.$inferInsert> = {
    updated_at: patch.updated_at ?? new Date(),
  };
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.schedule !== undefined) set.schedule = patch.schedule;
  if (patch.prompt !== undefined) set.prompt = patch.prompt;
  if (patch.skills !== undefined) set.skills = normalizeStringArray(patch.skills);
  if (patch.allowed_tools !== undefined)
    set.allowed_tools = normalizeStringArray(patch.allowed_tools);
  if (patch.denied_tools !== undefined) set.denied_tools = normalizeStringArray(patch.denied_tools);
  if (patch.script !== undefined) set.script = patch.script;
  if (patch.no_agent !== undefined) set.no_agent = patch.no_agent;
  if (patch.model_provider !== undefined) set.model_provider = patch.model_provider;
  if (patch.model_name !== undefined) set.model_name = patch.model_name;
  if (patch.workdir !== undefined) set.workdir = patch.workdir;
  if (patch.context_from !== undefined) {
    set.context_from = normalizeStringArray(patch.context_from);
  }
  if (patch.timeout_sec !== undefined) set.timeout_sec = patch.timeout_sec;
  if (patch.repeat !== undefined) set.repeat = patch.repeat;
  if (patch.run_count !== undefined) set.run_count = patch.run_count;
  if (patch.paused !== undefined) set.paused = patch.paused;
  if (patch.last_run_at !== undefined) set.last_run_at = patch.last_run_at;
  if (patch.last_output_ref !== undefined) set.last_output_ref = patch.last_output_ref;
  if (patch.notify_on_success !== undefined) set.notify_on_success = patch.notify_on_success;

  const db = getDb();
  const rows = await db.update(cronJobs).set(set).where(eq(cronJobs.id, trimmed)).returning({
    id: cronJobs.id,
  });
  return rows.length > 0;
}

export async function deleteCronJob(id: string): Promise<boolean> {
  const db = getDb();
  const deleted = await db
    .delete(cronJobs)
    .where(eq(cronJobs.id, id))
    .returning({ id: cronJobs.id });
  return deleted.length > 0;
}

export async function listAllCronJobs(): Promise<CronJobRow[]> {
  const db = getDb();
  return db.select().from(cronJobs).orderBy(asc(cronJobs.created_at));
}
