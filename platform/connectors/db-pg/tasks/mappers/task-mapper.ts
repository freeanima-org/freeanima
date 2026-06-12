import type { TaskPriority, TaskRow, TaskStatus } from "@freeanima/core/repos";
import {
  normalizePgTimestamp,
  taskPrioritySchema,
  taskStatusSchema,
} from "@freeanima/core/db/schema";
import type { tasks } from "@freeanima/core/db/schema";

export type TaskDbRow = typeof tasks.$inferSelect;

function normalizeStatus(raw: string): TaskStatus {
  const parsed = taskStatusSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`invalid task status: ${raw}`);
  return parsed.data;
}

function normalizePriority(raw: string): TaskPriority {
  const parsed = taskPrioritySchema.safeParse(raw);
  if (!parsed.success) throw new Error(`invalid task priority: ${raw}`);
  return parsed.data;
}

export function mapTaskRow(row: TaskDbRow): TaskRow {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: normalizeStatus(row.status),
    priority: normalizePriority(row.priority),
    due_at: row.dueAt != null ? normalizePgTimestamp(row.dueAt) : null,
    created_at: normalizePgTimestamp(row.createdAt),
    updated_at: normalizePgTimestamp(row.updatedAt),
    completed_at: row.completedAt != null ? normalizePgTimestamp(row.completedAt) : null,
    source_session_id: row.sourceSessionId,
  };
}
