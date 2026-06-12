import { taskListBodySchema, type TaskListBody } from "@freeanima/connectors-webui/api";
import type { AnimaService } from "@freeanima/service-api";
import { webuiCtx } from "./runtime.ts";

function normalizeStatus(status: TaskListBody["status"]): TaskListBody["status"] | undefined {
  if (status === undefined) return undefined;
  if (status === "all") return "all";
  if (Array.isArray(status)) return status;
  return [status];
}

export function createTasksHandlers(service: AnimaService) {
  return {
    listTasks: (body: TaskListBody) => {
      const parsed = taskListBodySchema.parse(body);
      return service.listTasks({
        query: parsed.query?.trim() || undefined,
        offset: parsed.offset,
        limit: parsed.limit,
        status: normalizeStatus(parsed.status),
        priority: parsed.priority,
      });
    },
  };
}

type TasksHandlers = ReturnType<typeof createTasksHandlers>;

let handlers: TasksHandlers | null = null;

function tasksHandlers(): TasksHandlers {
  if (!handlers) {
    handlers = createTasksHandlers(webuiCtx().service);
  }
  return handlers;
}

export async function listTasks(body: TaskListBody) {
  return tasksHandlers().listTasks(body);
}

export function resetTasksHandlersForTests(): void {
  handlers = null;
}
