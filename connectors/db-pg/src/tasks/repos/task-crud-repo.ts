import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { tasks, taskPrioritySchema, taskStatusSchema } from "@freeanima/engine-db/schema";
import type {
  TaskCreateInput,
  TaskListOpts,
  TaskPriority,
  TaskRow,
  TaskStatus,
  TaskUpdateInput,
} from "@freeanima/engine-repos";
import { formatCstIso } from "@freeanima/kernel-util";

import { getDb } from "../../client.ts";
import { mapTaskRow } from "../mappers/task-mapper.ts";

const DEFAULT_LIST_STATUSES: TaskStatus[] = ["pending", "in_progress"];
const DEFAULT_LIST_LIMIT = 50;

const priorityOrderSql = sql`CASE ${tasks.priority}
  WHEN 'high' THEN 0
  WHEN 'medium' THEN 1
  WHEN 'low' THEN 2
  ELSE 3
END`;

function normalizeStatus(raw: string | undefined, fallback: TaskStatus): TaskStatus {
  if (raw == null) return fallback;
  const parsed = taskStatusSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`invalid task status: ${raw}`);
  return parsed.data;
}

function normalizePriority(raw: string | undefined, fallback: TaskPriority): TaskPriority {
  if (raw == null) return fallback;
  const parsed = taskPrioritySchema.safeParse(raw);
  if (!parsed.success) throw new Error(`invalid task priority: ${raw}`);
  return parsed.data;
}

export async function createTask(input: TaskCreateInput): Promise<TaskRow> {
  const title = input.title.trim();
  if (!title) throw new Error("title is required");

  const now = formatCstIso();
  const db = getDb();
  const rows = await db
    .insert(tasks)
    .values({
      id: randomUUID(),
      title,
      description: input.description?.trim() || null,
      status: "pending",
      priority: normalizePriority(input.priority, "none"),
      dueAt: input.due_at ?? null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      sourceSessionId: input.source_session_id?.trim() || null,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error("failed to create task");
  return mapTaskRow(row);
}

export async function getTask(id: string): Promise<TaskRow | null> {
  const trimmed = id.trim();
  if (!trimmed) return null;
  const db = getDb();
  const rows = await db.select().from(tasks).where(eq(tasks.id, trimmed)).limit(1);
  const row = rows[0];
  return row ? mapTaskRow(row) : null;
}

export async function updateTask(input: TaskUpdateInput): Promise<TaskRow | null> {
  const trimmed = input.id.trim();
  if (!trimmed) return null;

  const existing = await getTask(trimmed);
  if (!existing) return null;

  const patch: Partial<typeof tasks.$inferInsert> = {
    updatedAt: formatCstIso(),
  };
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) throw new Error("title cannot be empty");
    patch.title = title;
  }
  if (input.description !== undefined) {
    patch.description = input.description?.trim() || null;
  }
  if (input.status !== undefined) {
    patch.status = normalizeStatus(input.status, existing.status);
  }
  if (input.priority !== undefined) {
    patch.priority = normalizePriority(input.priority, existing.priority);
  }
  if (input.due_at !== undefined) {
    patch.dueAt = input.due_at;
  }
  if (input.completed_at !== undefined) {
    patch.completedAt = input.completed_at;
  }

  const db = getDb();
  const rows = await db.update(tasks).set(patch).where(eq(tasks.id, trimmed)).returning();
  const row = rows[0];
  return row ? mapTaskRow(row) : null;
}

export async function listTasks(opts?: TaskListOpts): Promise<TaskRow[]> {
  const statuses = opts?.status?.length ? opts.status : DEFAULT_LIST_STATUSES;
  const limit = Math.max(1, Math.min(500, opts?.limit ?? DEFAULT_LIST_LIMIT));

  const conditions = [inArray(tasks.status, statuses)];
  if (opts?.priority) {
    conditions.push(eq(tasks.priority, normalizePriority(opts.priority, "none")));
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(asc(priorityOrderSql), asc(tasks.createdAt))
    .limit(limit);
  return rows.map(mapTaskRow);
}
