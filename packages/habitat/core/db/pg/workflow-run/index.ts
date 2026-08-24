import { and, desc, eq } from "drizzle-orm";
import { randomPublicId } from "@freeanima/shared/util";
import { workflowRuns } from "@freeanima/habitat/core/db/schema";
import { omitUndefined } from "@freeanima/habitat/core/util";
import { getDb } from "../client.ts";

export type WorkflowRunStatus = "running" | "completed" | "failed";

export type WorkflowRunRow = {
  id: string;
  workflow_entity_id: number | null;
  name: string | null;
  input: unknown;
  output: unknown;
  status: string;
  error: string | null;
  subject_id: number | null;
  world_id: number | null;
  created_at: string;
  finished_at: string | null;
};

export type WorkflowRunInsertInput = {
  id?: string;
  workflow_entity_id?: number | null;
  name?: string | null;
  input: unknown;
  subject_id?: number | null;
  world_id?: number | null;
};

export type WorkflowRunFinishInput = {
  id: string;
  status: "completed" | "failed";
  output?: unknown;
  error?: string | null;
};

type DbRow = typeof workflowRuns.$inferSelect;

function mapRow(raw: DbRow): WorkflowRunRow {
  return {
    id: raw.id,
    workflow_entity_id: raw.workflow_entity_id,
    name: raw.name,
    input: raw.input,
    output: raw.output,
    status: raw.status,
    error: raw.error,
    subject_id: raw.subject_id,
    world_id: raw.world_id,
    created_at: String(raw.created_at),
    finished_at: raw.finished_at != null ? String(raw.finished_at) : null,
  };
}

export function generateWorkflowRunId(): string {
  return `wf_${randomPublicId()}`;
}

export async function insertRunningWorkflowRun(
  input: WorkflowRunInsertInput,
): Promise<WorkflowRunRow> {
  const db = getDb();
  const id = input.id ?? generateWorkflowRunId();
  const [row] = await db
    .insert(workflowRuns)
    .values({
      id,
      workflow_entity_id: input.workflow_entity_id ?? null,
      name: input.name ?? null,
      input: input.input ?? {},
      output: null,
      status: "running",
      error: null,
      subject_id: input.subject_id ?? null,
      world_id: input.world_id ?? null,
      created_at: new Date(),
      finished_at: null,
    })
    .returning();
  if (!row) throw new Error("failed to insert workflow_runs");
  return mapRow(row);
}

export async function finishWorkflowRun(input: WorkflowRunFinishInput): Promise<WorkflowRunRow> {
  const db = getDb();
  const [row] = await db
    .update(workflowRuns)
    .set(
      omitUndefined({
        status: input.status,
        output: input.output,
        error: input.error ?? null,
        finished_at: new Date(),
      }),
    )
    .where(eq(workflowRuns.id, input.id))
    .returning();
  if (!row) throw new Error(`workflow_run not found: ${input.id}`);
  return mapRow(row);
}

export async function getWorkflowRun(id: string): Promise<WorkflowRunRow | null> {
  const db = getDb();
  const [row] = await db.select().from(workflowRuns).where(eq(workflowRuns.id, id)).limit(1);
  return row ? mapRow(row) : null;
}

/** 具名 Workflow 最近一次成功 run（供 $last_run） */
export async function getLatestSuccessfulWorkflowRun(opts: {
  workflow_entity_id?: number;
  name?: string;
  world_id?: number;
}): Promise<WorkflowRunRow | null> {
  const db = getDb();
  const conditions = [eq(workflowRuns.status, "completed")];
  if (opts.workflow_entity_id != null) {
    conditions.push(eq(workflowRuns.workflow_entity_id, opts.workflow_entity_id));
  } else if (opts.name != null && opts.name.length > 0) {
    conditions.push(eq(workflowRuns.name, opts.name));
    if (opts.world_id != null) {
      conditions.push(eq(workflowRuns.world_id, opts.world_id));
    }
  } else {
    return null;
  }
  const [row] = await db
    .select()
    .from(workflowRuns)
    .where(and(...conditions))
    .orderBy(desc(workflowRuns.created_at))
    .limit(1);
  return row ? mapRow(row) : null;
}
