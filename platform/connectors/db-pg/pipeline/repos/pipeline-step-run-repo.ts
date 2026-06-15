import { and, desc, eq, max, sql } from "drizzle-orm";
import { pipelineStepRun } from "@freeanima/core/db/schema";
import type {
  PipelineStepRunAppendInput,
  PipelineStepRunListOpts,
  PipelineStepRunRow,
} from "@freeanima/core/repos";
import { formatCstIso } from "@freeanima/core/util";

import { getDb } from "../../client.ts";

export type PipelineStepRunDbRow = typeof pipelineStepRun.$inferSelect;

export function mapRow(raw: PipelineStepRunDbRow): PipelineStepRunRow {
  return {
    id: raw.id,
    pipeline_id: raw.pipelineId,
    run_id: raw.runId,
    step_id: raw.stepId,
    attempt: raw.attempt,
    day: raw.day,
    trigger: raw.trigger,
    status: raw.status,
    started_at: raw.startedAt ? String(raw.startedAt) : null,
    finished_at: String(raw.finishedAt),
    output: raw.output as Record<string, unknown> | null,
    error: raw.error,
    skipped_reason: raw.skippedReason,
  };
}

async function nextAttempt(runId: string, stepId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ maxAttempt: max(pipelineStepRun.attempt) })
    .from(pipelineStepRun)
    .where(and(eq(pipelineStepRun.runId, runId), eq(pipelineStepRun.stepId, stepId)));
  return (row?.maxAttempt ?? 0) + 1;
}

export async function appendPipelineStepRun(row: PipelineStepRunAppendInput): Promise<void> {
  const attempt = await nextAttempt(row.run_id, row.step_id);
  const finishedAt = row.finished_at ?? formatCstIso();
  const errorText = row.error != null ? row.error.slice(0, 2000) : null;
  const skippedReason = row.skipped_reason != null ? row.skipped_reason.slice(0, 500) : null;

  const db = getDb();
  await db.insert(pipelineStepRun).values({
    pipelineId: row.pipeline_id,
    runId: row.run_id,
    stepId: row.step_id,
    attempt,
    day: row.day,
    trigger: row.trigger,
    status: row.status,
    startedAt: row.started_at ?? null,
    finishedAt,
    output: row.output ?? null,
    error: errorText,
    skippedReason,
  });
}

export async function listPipelineStepRuns(
  opts?: PipelineStepRunListOpts,
): Promise<PipelineStepRunRow[]> {
  const limit = Math.max(1, Math.min(200, opts?.limit ?? 50));
  const offset = Math.max(0, opts?.offset ?? 0);

  const conditions = [];
  if (opts?.pipeline_id?.trim()) {
    conditions.push(eq(pipelineStepRun.pipelineId, opts.pipeline_id.trim()));
  }
  if (opts?.run_id?.trim()) {
    conditions.push(eq(pipelineStepRun.runId, opts.run_id.trim()));
  }
  if (opts?.step_id?.trim()) {
    conditions.push(eq(pipelineStepRun.stepId, opts.step_id.trim()));
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(pipelineStepRun)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(pipelineStepRun.finishedAt), desc(pipelineStepRun.id))
    .offset(offset)
    .limit(limit);
  return rows.map(mapRow);
}

/** 测试用：清空表 */
export async function clearPipelineStepRunsForTests(): Promise<void> {
  const db = getDb();
  await db.delete(pipelineStepRun).where(sql`true`);
}
