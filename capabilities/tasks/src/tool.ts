import { getToolSessionId } from "@freeanima/engine-loop";
import type { ToolSetRegistry } from "@freeanima/engine-tool";
import { toolError, toolResult } from "@freeanima/engine-tool";
import { formatCstIso } from "@freeanima/kernel-util";
import type {
  TaskListOpts,
  TaskPriority,
  TaskRow,
  TaskStatus,
  TaskStorePort,
} from "@freeanima/engine-repos";
import { TASK_PRIORITIES, TASK_STATUSES } from "@freeanima/engine-repos";

import type { FridgeBridge } from "./types.ts";
import { syncTasksSummary } from "./fridge-bridge.ts";
import { getTaskStore, registerTaskStore } from "./task-port.ts";

let fridgeBridge: FridgeBridge | undefined;

export function registerTasksModule(opts: {
  taskStore: TaskStorePort;
  fridgeBridge?: FridgeBridge;
}): void {
  registerTaskStore(opts.taskStore);
  fridgeBridge = opts.fridgeBridge;
}

export function resetTasksModuleForTests(): void {
  fridgeBridge = undefined;
}

function resolveStore(): TaskStorePort | null {
  try {
    return getTaskStore();
  } catch {
    return null;
  }
}

function taskPayload(task: TaskRow) {
  return {
    ok: true,
    task: {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      due_at: task.due_at,
      created_at: task.created_at,
      updated_at: task.updated_at,
      completed_at: task.completed_at,
      source_session_id: task.source_session_id,
    },
  };
}

async function afterMutation(store: TaskStorePort): Promise<void> {
  await syncTasksSummary(store, fridgeBridge);
}

function parsePriority(raw: unknown): TaskPriority | undefined {
  if (raw == null || raw === "") return undefined;
  const s = String(raw);
  return TASK_PRIORITIES.includes(s as TaskPriority) ? (s as TaskPriority) : undefined;
}

function parseStatus(raw: unknown): TaskStatus | undefined {
  if (raw == null || raw === "") return undefined;
  const s = String(raw);
  return TASK_STATUSES.includes(s as TaskStatus) ? (s as TaskStatus) : undefined;
}

function parseStatusList(raw: unknown): TaskStatus[] | undefined {
  if (raw == null) return undefined;
  if (Array.isArray(raw)) {
    return raw
      .map((v) => String(v))
      .filter((s): s is TaskStatus => TASK_STATUSES.includes(s as TaskStatus));
  }
  const single = parseStatus(raw);
  return single ? [single] : undefined;
}

async function handleCreateTask(args: Record<string, unknown>): Promise<string> {
  const store = resolveStore();
  if (!store) return toolError("任务存储未配置");

  const title = String(args.title ?? "").trim();
  if (!title) return toolError("title is required");

  const priority = parsePriority(args.priority);
  if (args.priority != null && args.priority !== "" && !priority) {
    return toolError(`invalid priority: ${args.priority}`);
  }

  const dueAt = args.due_at != null && args.due_at !== "" ? String(args.due_at).trim() : null;
  const description =
    args.description != null && args.description !== "" ? String(args.description).trim() : null;

  try {
    const task = await store.create({
      title,
      description,
      priority,
      due_at: dueAt,
      source_session_id: getToolSessionId() ?? null,
    });
    await afterMutation(store);
    return toolResult({ ...taskPayload(task), action: "create" });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleUpdateTask(args: Record<string, unknown>): Promise<string> {
  const store = resolveStore();
  if (!store) return toolError("任务存储未配置");

  const id = String(args.id ?? "").trim();
  if (!id) return toolError("id is required");

  const patch: Parameters<TaskStorePort["update"]>[0] = { id };
  if (args.title !== undefined) patch.title = String(args.title);
  if (args.description !== undefined) {
    patch.description = args.description != null ? String(args.description) : null;
  }
  if (args.status !== undefined) {
    const status = parseStatus(args.status);
    if (!status) return toolError(`invalid status: ${args.status}`);
    patch.status = status;
  }
  if (args.priority !== undefined) {
    const priority = parsePriority(args.priority);
    if (!priority) return toolError(`invalid priority: ${args.priority}`);
    patch.priority = priority;
  }
  if (args.due_at !== undefined) {
    patch.due_at = args.due_at != null && args.due_at !== "" ? String(args.due_at) : null;
  }

  try {
    const task = await store.update(patch);
    if (!task) return toolError(`task not found: ${id}`);
    await afterMutation(store);
    return toolResult({ ...taskPayload(task), action: "update" });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleStatusChange(
  args: Record<string, unknown>,
  status: TaskStatus,
  action: string,
): Promise<string> {
  const store = resolveStore();
  if (!store) return toolError("任务存储未配置");

  const id = String(args.id ?? "").trim();
  if (!id) return toolError("id is required");

  const completedAt =
    status === "pending" ? null : status === "in_progress" ? null : formatCstIso();

  try {
    const task = await store.update({
      id,
      status,
      completed_at: completedAt,
    });
    if (!task) return toolError(`task not found: ${id}`);
    await afterMutation(store);
    return toolResult({ ...taskPayload(task), action });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleGetTask(args: Record<string, unknown>): Promise<string> {
  const store = resolveStore();
  if (!store) return toolError("任务存储未配置");

  const id = String(args.id ?? "").trim();
  if (!id) return toolError("id is required");

  const task = await store.get(id);
  if (!task) return toolError(`task not found: ${id}`);
  return toolResult({ ...taskPayload(task), action: "get" });
}

async function handleListTasks(args: Record<string, unknown>): Promise<string> {
  const store = resolveStore();
  if (!store) return toolError("任务存储未配置");

  const opts: TaskListOpts = {};
  const statuses = parseStatusList(args.status);
  if (args.status != null && statuses?.length === 0) {
    return toolError(`invalid status filter: ${args.status}`);
  }
  if (statuses?.length) opts.status = statuses;

  const priority = parsePriority(args.priority);
  if (args.priority != null && args.priority !== "" && !priority) {
    return toolError(`invalid priority: ${args.priority}`);
  }
  if (priority) opts.priority = priority;

  if (typeof args.limit === "number") opts.limit = args.limit;

  const tasks = await store.list(opts);
  return toolResult({
    ok: true,
    action: "list",
    count: tasks.length,
    tasks: tasks.map((t) => taskPayload(t).task),
  });
}

export function registerTaskTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet("tasks", "跨 session 持久待办", [
    {
      name: "tasks_create",
      description: "创建跨 session 持久待办任务",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "任务标题" },
          description: { type: "string", description: "任务详情（可选）" },
          priority: {
            type: "string",
            enum: [...TASK_PRIORITIES],
            description: "优先级，默认 none",
          },
          due_at: { type: "string", description: "截止时间 ISO8601（可选）" },
        },
        required: ["title"],
      },
      handler: handleCreateTask,
    },
    {
      name: "tasks_update",
      description: "更新待办任务字段",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "任务 ID" },
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: [...TASK_STATUSES] },
          priority: { type: "string", enum: [...TASK_PRIORITIES] },
          due_at: { type: "string" },
        },
        required: ["id"],
      },
      handler: handleUpdateTask,
    },
    {
      name: "tasks_complete",
      description: "将任务标记为 completed",
      parameters: {
        type: "object",
        properties: { id: { type: "string", description: "任务 ID" } },
        required: ["id"],
      },
      handler: (args) => handleStatusChange(args, "completed", "complete"),
    },
    {
      name: "tasks_cancel",
      description: "将任务标记为 cancelled",
      parameters: {
        type: "object",
        properties: { id: { type: "string", description: "任务 ID" } },
        required: ["id"],
      },
      handler: (args) => handleStatusChange(args, "cancelled", "cancel"),
    },
    {
      name: "tasks_reopen",
      description: "将任务重新打开为 pending",
      parameters: {
        type: "object",
        properties: { id: { type: "string", description: "任务 ID" } },
        required: ["id"],
      },
      handler: (args) => handleStatusChange(args, "pending", "reopen"),
    },
    {
      name: "tasks_list",
      description: "列出待办；默认 pending + in_progress，按 priority 降序、created_at 升序",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "array",
            items: { type: "string", enum: [...TASK_STATUSES] },
            description: "状态过滤；默认 pending + in_progress",
          },
          priority: { type: "string", enum: [...TASK_PRIORITIES] },
          limit: { type: "integer", description: "最大条数，默认 50" },
        },
      },
      handler: handleListTasks,
    },
    {
      name: "tasks_get",
      description: "按 ID 获取单条任务",
      parameters: {
        type: "object",
        properties: { id: { type: "string", description: "任务 ID" } },
        required: ["id"],
      },
      handler: handleGetTask,
    },
  ]);
}
