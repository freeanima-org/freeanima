import { entities } from "@freeanima/habitat/core/db/schema";
import {
  WORKFLOW_COMPONENT,
  asWorkflow,
  isValidWorkflowName,
  workflowBodySchema,
} from "@freeanima/habitat/core/db/schema/entity";
import { getDb } from "@freeanima/habitat/core/db/pg/client";
import {
  createEntity,
  deleteEntity,
  getEntity,
  listEntities,
  updateEntity,
} from "@freeanima/habitat/core/db/pg/entity";
import { omitUndefined } from "@freeanima/habitat/core/util";
import { and, eq, ne } from "drizzle-orm";

import type { WorkflowCreateInput, WorkflowRow, WorkflowUpdateInput } from "./types.ts";

function toRow(
  parsed: NonNullable<ReturnType<typeof asWorkflow>>,
  meta: { created_at: Date; updated_at: Date },
): WorkflowRow {
  return {
    id: parsed.id,
    world_id: parsed.world_id,
    name: parsed.title,
    title: parsed.title,
    summary: parsed.summary,
    content: parsed.content,
    steps: parsed.steps,
    ...(parsed.input_schema != null ? { input_schema: parsed.input_schema } : {}),
    ...(parsed.output_schema != null ? { output_schema: parsed.output_schema } : {}),
    origin: parsed.origin,
    status: parsed.status,
    allowed_tools: parsed.allowed_tools,
    denied_tools: parsed.denied_tools,
    ...(parsed.pure != null ? { pure: parsed.pure } : {}),
    created_at: meta.created_at.toISOString(),
    updated_at: meta.updated_at.toISOString(),
  };
}

async function assertNameUnique(worldId: number, name: string, excludeId?: number): Promise<void> {
  const db = getDb();
  const conditions = [
    eq(entities.world_id, worldId),
    eq(entities.primary_component, WORKFLOW_COMPONENT),
    eq(entities.title, name),
  ];
  if (excludeId != null) {
    conditions.push(ne(entities.id, excludeId));
  }
  const [existing] = await db
    .select({ id: entities.id })
    .from(entities)
    .where(and(...conditions))
    .limit(1);
  if (existing) {
    throw new Error(`workflow name already exists: ${name}`);
  }
}

function derivePure(steps: WorkflowCreateInput["steps"], explicit?: boolean): boolean | undefined {
  if (explicit != null) return explicit;
  if (steps.some((s) => s.type === "llm")) return false;
  if (steps.every((s) => ("pure" in s && s.pure === true) || s.type === "transform")) {
    return true;
  }
  return undefined;
}

export async function listWorkflows(worldId: number): Promise<WorkflowRow[]> {
  const rows = await listEntities({
    world_id: worldId,
    primary_component: WORKFLOW_COMPONENT,
    limit: 500,
  });
  const out: WorkflowRow[] = [];
  for (const row of rows) {
    const parsed = asWorkflow(row);
    if (parsed) out.push(toRow(parsed, { created_at: row.created_at, updated_at: row.updated_at }));
  }
  return out.toSorted((a, b) => a.name.localeCompare(b.name));
}

export async function getWorkflow(id: number): Promise<WorkflowRow | null> {
  const row = await getEntity(id);
  if (!row) return null;
  const parsed = asWorkflow(row);
  return parsed ? toRow(parsed, { created_at: row.created_at, updated_at: row.updated_at }) : null;
}

export async function getWorkflowByName(
  worldId: number,
  name: string,
): Promise<WorkflowRow | null> {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;
  const db = getDb();
  const [hit] = await db
    .select({ id: entities.id })
    .from(entities)
    .where(
      and(
        eq(entities.world_id, worldId),
        eq(entities.primary_component, WORKFLOW_COMPONENT),
        eq(entities.title, normalized),
      ),
    )
    .limit(1);
  if (!hit) return null;
  return getWorkflow(hit.id);
}

export async function createWorkflow(
  worldId: number,
  input: WorkflowCreateInput,
): Promise<WorkflowRow> {
  const name = input.name.trim().toLowerCase();
  if (!isValidWorkflowName(name)) {
    throw new Error(`invalid workflow name: ${input.name}`);
  }
  await assertNameUnique(worldId, name);
  const pure = derivePure(input.steps, input.pure);
  const body = workflowBodySchema.parse({
    steps: input.steps,
    input_schema: input.input_schema,
    output_schema: input.output_schema,
    origin: input.origin ?? "user",
    status: input.status ?? "active",
    allowed_tools: input.allowed_tools ?? [],
    denied_tools: input.denied_tools ?? [],
    ...(pure != null ? { pure } : {}),
  });
  const created = await createEntity({
    type: "content",
    world_id: worldId,
    primary_component: WORKFLOW_COMPONENT,
    components: [WORKFLOW_COMPONENT],
    title: name,
    summary: input.summary?.trim() ?? "",
    content: input.content ?? "",
    body,
  });
  const parsed = asWorkflow(created);
  if (!parsed) throw new Error("failed to create workflow");
  return toRow(parsed, { created_at: created.created_at, updated_at: created.updated_at });
}

export async function updateWorkflow(
  worldId: number,
  input: WorkflowUpdateInput,
): Promise<WorkflowRow> {
  const existing = await getWorkflow(input.id);
  if (!existing || existing.world_id !== worldId) {
    throw new Error(`workflow not found: ${input.id}`);
  }
  let name = existing.name;
  if (input.name != null) {
    name = input.name.trim().toLowerCase();
    if (!isValidWorkflowName(name)) {
      throw new Error(`invalid workflow name: ${input.name}`);
    }
    if (name !== existing.name) {
      await assertNameUnique(worldId, name, input.id);
    }
  }
  const steps = input.steps ?? existing.steps;
  const pure = input.pure === null ? undefined : (input.pure ?? derivePure(steps, existing.pure));
  const body = workflowBodySchema.parse({
    steps,
    input_schema:
      input.input_schema === null ? undefined : (input.input_schema ?? existing.input_schema),
    output_schema:
      input.output_schema === null ? undefined : (input.output_schema ?? existing.output_schema),
    origin: input.origin ?? existing.origin,
    status: input.status ?? existing.status,
    allowed_tools: input.allowed_tools ?? existing.allowed_tools,
    denied_tools: input.denied_tools ?? existing.denied_tools,
    ...(pure != null ? { pure } : {}),
  });
  const updated = await updateEntity(
    omitUndefined({
      id: input.id,
      title: name,
      summary: input.summary,
      content: input.content,
      body,
    }),
  );
  if (!updated) throw new Error(`workflow not found: ${input.id}`);
  const parsed = asWorkflow(updated);
  if (!parsed) throw new Error("failed to update workflow");
  return toRow(parsed, { created_at: updated.created_at, updated_at: updated.updated_at });
}

export async function deleteWorkflow(worldId: number, id: number): Promise<void> {
  const existing = await getWorkflow(id);
  if (!existing || existing.world_id !== worldId) {
    throw new Error(`workflow not found: ${id}`);
  }
  await deleteEntity(id);
}
