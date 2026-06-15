import { asc, eq } from "drizzle-orm";
import { cronJobs } from "@freeanima/core/db/schema";
import type {
  CronJobBuiltinUpsertInput,
  CronJobCreateInput,
  CronJobRow,
  CronJobUpdateInput,
} from "@freeanima/core/repos";
import { formatCstIso } from "@freeanima/core/util";

import { getDb } from "../../client.ts";
import { mapCronJobRow } from "../mappers/cron-mapper.ts";

function normalizeStringArray(raw: string[] | undefined | null): string[] {
  if (!raw) return [];
  return raw.map((s) => s.trim()).filter(Boolean);
}

export async function createCronJob(row: CronJobCreateInput): Promise<void> {
  const now = formatCstIso();
  const created = row.created_at ?? now;
  const updated = row.updated_at ?? created;
  const db = getDb();
  await db.insert(cronJobs).values({
    id: row.id,
    name: row.name,
    schedule: row.schedule,
    prompt: row.prompt ?? "",
    skills: normalizeStringArray(row.skills),
    script: row.script ?? null,
    noAgent: row.no_agent ?? false,
    modelProvider: row.model_provider ?? null,
    modelName: row.model_name ?? null,
    workdir: row.workdir ?? null,
    contextFrom: normalizeStringArray(row.context_from),
    deliver: row.deliver ?? "local",
    timeoutSec: row.timeout_sec ?? 300,
    builtin: row.builtin ?? false,
    repeat: row.repeat ?? null,
    runCount: row.run_count ?? 0,
    paused: row.paused ?? false,
    createdAt: created,
    updatedAt: updated,
    lastRunAt: row.last_run_at ?? null,
    lastOutputRef: row.last_output_ref ?? null,
  });
}

/** Built-in job upsert: on conflict only updates name/schedule/updated_at; returns whether schedule changed */
export async function upsertBuiltinCronJob(row: CronJobBuiltinUpsertInput): Promise<boolean> {
  const now = formatCstIso();
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
      noAgent: row.no_agent ?? true,
      builtin: true,
      deliver: row.deliver ?? "local",
      timeoutSec: row.timeout_sec ?? 1800,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: cronJobs.id,
      set: {
        name: row.name,
        schedule: row.schedule,
        updatedAt: now,
      },
    });

  return scheduleChanged;
}

export async function getCronJob(id: string): Promise<CronJobRow | null> {
  const db = getDb();
  const rows = await db.select().from(cronJobs).where(eq(cronJobs.id, id)).limit(1);
  const row = rows[0];
  return row ? mapCronJobRow(row) : null;
}

export async function updateCronJob(patch: CronJobUpdateInput): Promise<boolean> {
  const trimmed = patch.id.trim();
  if (!trimmed) return false;

  const set: Partial<typeof cronJobs.$inferInsert> = {
    updatedAt: patch.updated_at ?? formatCstIso(),
  };
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.schedule !== undefined) set.schedule = patch.schedule;
  if (patch.prompt !== undefined) set.prompt = patch.prompt;
  if (patch.skills !== undefined) set.skills = normalizeStringArray(patch.skills);
  if (patch.script !== undefined) set.script = patch.script;
  if (patch.no_agent !== undefined) set.noAgent = patch.no_agent;
  if (patch.model_provider !== undefined) set.modelProvider = patch.model_provider;
  if (patch.model_name !== undefined) set.modelName = patch.model_name;
  if (patch.workdir !== undefined) set.workdir = patch.workdir;
  if (patch.context_from !== undefined) {
    set.contextFrom = normalizeStringArray(patch.context_from);
  }
  if (patch.deliver !== undefined) set.deliver = patch.deliver;
  if (patch.timeout_sec !== undefined) set.timeoutSec = patch.timeout_sec;
  if (patch.repeat !== undefined) set.repeat = patch.repeat;
  if (patch.run_count !== undefined) set.runCount = patch.run_count;
  if (patch.paused !== undefined) set.paused = patch.paused;
  if (patch.last_run_at !== undefined) set.lastRunAt = patch.last_run_at;
  if (patch.last_output_ref !== undefined) set.lastOutputRef = patch.last_output_ref;

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
  const rows = await db.select().from(cronJobs).orderBy(asc(cronJobs.createdAt));
  return rows.map(mapCronJobRow);
}
