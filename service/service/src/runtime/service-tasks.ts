import type { TaskPriority, TaskRow, TaskStatus } from "@freeanima/storage-repos";
import { TASK_STATUSES } from "@freeanima/storage-repos";
import { getServiceContext } from "../context.ts";

export type TaskListResult = {
  items: TaskRow[];
  total: number;
  offset: number;
  limit: number;
};

function clampPagination(offset?: number, limit?: number) {
  const safeLimit = Math.max(1, Math.min(100, limit ?? 20));
  const safeOffset = Math.max(0, offset ?? 0);
  return { offset: safeOffset, limit: safeLimit };
}

function resolveStatuses(status?: TaskStatus[] | "all"): TaskStatus[] {
  if (status === "all") return [...TASK_STATUSES];
  if (status?.length) return status;
  return ["pending", "in_progress"];
}

function repos() {
  return getServiceContext().engine.repos;
}

export async function listTasks(
  args: {
    query?: string;
    offset?: number;
    limit?: number;
    status?: TaskStatus[] | "all";
    priority?: TaskPriority;
  } = {},
): Promise<TaskListResult> {
  const { offset, limit } = clampPagination(args.offset, args.limit);
  const statuses = resolveStatuses(args.status);
  const filterOpts = {
    query: args.query?.trim() || undefined,
    status: statuses,
    priority: args.priority,
  };
  const [items, total] = await Promise.all([
    repos().tasks.list({ ...filterOpts, offset, limit }),
    repos().tasks.count(filterOpts),
  ]);
  return { items, total, offset, limit };
}
