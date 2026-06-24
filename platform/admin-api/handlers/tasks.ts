import { taskListBodySchema, type TaskListBody } from "@freeanima/admin-api/api";
import { adminCtx } from "./runtime.ts";

function normalizeStatus(status: TaskListBody["status"]): TaskListBody["status"] | undefined {
  if (status === undefined) return undefined;
  if (status === "all") return "all";
  if (Array.isArray(status)) return status;
  return [status];
}

export async function listTasks(body: TaskListBody) {
  const parsed = taskListBodySchema.parse(body);
  return adminCtx().listTasks({
    query: parsed.query?.trim() || undefined,
    offset: parsed.offset,
    limit: parsed.limit,
    status: normalizeStatus(parsed.status),
    priority: parsed.priority,
  });
}
