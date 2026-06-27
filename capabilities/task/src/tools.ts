import type { ToolSetRegistry } from "@freeanima/core/tool";
import { attachToolReturns, toolError, toolResult } from "@freeanima/core/tool";
import type { TaskItemPriority } from "@freeanima/core/db/schema/entity";

import {
  completeTaskItem,
  createTaskItem,
  deleteTaskItem,
  listTaskItems,
  uncompleteTaskItem,
  updateTaskItem,
} from "./item-store.ts";
import { getDefaultTaskList, listTaskLists } from "./list-store.ts";
import { getTaskFridgeBridge, syncAfterTaskMutation } from "./entity-port.ts";
import { TASK_TOOL_RETURNS } from "./return-schemas.ts";
import type { TaskItemRow } from "./types.ts";

const PRIORITIES: TaskItemPriority[] = ["high", "medium", "low", "none"];

function parsePriority(raw: unknown): TaskItemPriority | undefined {
  if (raw == null || raw === "") return undefined;
  const s = String(raw);
  return PRIORITIES.includes(s as TaskItemPriority) ? (s as TaskItemPriority) : undefined;
}

function parseTags(raw: unknown): string[] | undefined {
  if (raw == null) return undefined;
  if (Array.isArray(raw)) return raw.map((v) => String(v));
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return undefined;
}

function itemPayload(item: TaskItemRow) {
  return {
    id: item.id,
    title: item.title,
    content: item.content,
    tags: item.tags,
    status: item.status,
    priority: item.priority,
    due_at: item.due_at,
    list_id: item.list_id,
    sort_order: item.sort_order,
    completed_at: item.completed_at,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

async function refreshFridge(): Promise<void> {
  const items = await listTaskItems({ status: "pending", limit: 500 });
  await syncAfterTaskMutation(items);
}

async function resolveListId(raw: unknown): Promise<number | null> {
  if (raw == null || raw === "") {
    const list = await getDefaultTaskList();
    return list?.id ?? null;
  }
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function handleCreate(args: Record<string, unknown>): Promise<string> {
  const title = String(args.title ?? "").trim();
  if (!title) return toolError("title is required");

  const listId = await resolveListId(args.list_id);
  if (listId == null) return toolError("task list not available");

  const priority = parsePriority(args.priority);
  if (args.priority != null && args.priority !== "" && !priority) {
    return toolError(`invalid priority: ${args.priority}`);
  }

  const tags = parseTags(args.tags);
  const dueAt = args.due_at != null && args.due_at !== "" ? String(args.due_at).trim() : null;
  const content = args.content != null ? String(args.content) : "";

  try {
    const item = await createTaskItem({
      title,
      content,
      tags,
      list_id: listId,
      priority,
      due_at: dueAt,
    });
    await refreshFridge();
    return toolResult({ ok: true, action: "create", item: itemPayload(item) });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleUpdate(args: Record<string, unknown>): Promise<string> {
  const id = Number(args.id);
  if (!Number.isFinite(id) || id <= 0) return toolError("id is required");

  const patch: Parameters<typeof updateTaskItem>[0] = { id };
  if (args.title !== undefined) patch.title = String(args.title);
  if (args.content !== undefined) patch.content = String(args.content);
  if (args.tags !== undefined) patch.tags = parseTags(args.tags);
  if (args.list_id !== undefined) {
    const listId = Number(args.list_id);
    if (!Number.isFinite(listId) || listId <= 0) return toolError("invalid list_id");
    patch.list_id = listId;
  }
  if (args.priority !== undefined) {
    const priority = parsePriority(args.priority);
    if (!priority) return toolError(`invalid priority: ${args.priority}`);
    patch.priority = priority;
  }
  if (args.due_at !== undefined) {
    patch.due_at = args.due_at != null && args.due_at !== "" ? String(args.due_at) : null;
  }
  if (args.sort_order !== undefined) patch.sort_order = Number(args.sort_order);

  try {
    const item = await updateTaskItem(patch);
    if (!item) return toolError(`task not found: ${id}`);
    await refreshFridge();
    return toolResult({ ok: true, action: "update", item: itemPayload(item) });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleComplete(args: Record<string, unknown>, uncomplete: boolean): Promise<string> {
  const id = Number(args.id);
  if (!Number.isFinite(id) || id <= 0) return toolError("id is required");

  try {
    const item = uncomplete ? await uncompleteTaskItem(id) : await completeTaskItem(id);
    if (!item) return toolError(`task not found: ${id}`);
    await refreshFridge();
    return toolResult({
      ok: true,
      action: uncomplete ? "uncomplete" : "complete",
      item: itemPayload(item),
    });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleDelete(args: Record<string, unknown>): Promise<string> {
  const id = Number(args.id);
  if (!Number.isFinite(id) || id <= 0) return toolError("id is required");

  try {
    const ok = await deleteTaskItem(id);
    if (!ok) return toolError(`task not found: ${id}`);
    await refreshFridge();
    return toolResult({ ok: true, action: "delete", id });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleGet(args: Record<string, unknown>): Promise<string> {
  const id = Number(args.id);
  if (!Number.isFinite(id) || id <= 0) return toolError("id is required");

  const items = await listTaskItems({ status: "all", limit: 500 });
  const item = items.find((row) => row.id === id);
  if (!item) return toolError(`task not found: ${id}`);
  return toolResult({ ok: true, action: "get", item: itemPayload(item) });
}

async function handleList(args: Record<string, unknown>): Promise<string> {
  const listId = args.list_id != null && args.list_id !== "" ? Number(args.list_id) : undefined;
  const status =
    args.status === "completed" || args.status === "pending" || args.status === "all"
      ? args.status
      : "pending";
  const tags = parseTags(args.tags);
  const limit = typeof args.limit === "number" ? args.limit : 50;

  const items = await listTaskItems({
    list_id: listId,
    status,
    tags,
    limit,
  });
  return toolResult({
    ok: true,
    action: "list",
    count: items.length,
    items: items.map(itemPayload),
  });
}

async function handleListLists(): Promise<string> {
  const lists = await listTaskLists();
  return toolResult({
    ok: true,
    action: "list_lists",
    count: lists.length,
    lists: lists.map((l) => ({
      id: l.id,
      name: l.name,
      sort_order: l.sort_order,
      closed: l.closed,
      is_default: l.is_default,
      item_count: l.item_count,
    })),
  });
}

export function registerTaskTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "task",
    "Entity-based task lists and items",
    attachToolReturns(
      [
        {
          name: "task_create",
          description: "Create a task item in a list (default list when list_id omitted)",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "Task title" },
              content: { type: "string", description: "Task body / details" },
              tags: {
                type: "array",
                items: { type: "string" },
                description: "Optional tags",
              },
              list_id: { type: "integer", description: "Target list id (default inbox)" },
              priority: { type: "string", enum: PRIORITIES },
              due_at: { type: "string", description: "Due time ISO8601" },
            },
            required: ["title"],
          },
          handler: handleCreate,
        },
        {
          name: "task_update",
          description: "Update task item fields",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: {
              id: { type: "integer" },
              title: { type: "string" },
              content: { type: "string" },
              tags: { type: "array", items: { type: "string" } },
              list_id: { type: "integer" },
              priority: { type: "string", enum: PRIORITIES },
              due_at: { type: "string" },
              sort_order: { type: "integer" },
            },
            required: ["id"],
          },
          handler: handleUpdate,
        },
        {
          name: "task_complete",
          description: "Mark task as completed",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: { id: { type: "integer" } },
            required: ["id"],
          },
          handler: (args) => handleComplete(args, false),
        },
        {
          name: "task_uncomplete",
          description: "Mark completed task as pending",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: { id: { type: "integer" } },
            required: ["id"],
          },
          handler: (args) => handleComplete(args, true),
        },
        {
          name: "task_delete",
          description: "Delete a task item",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: { id: { type: "integer" } },
            required: ["id"],
          },
          handler: handleDelete,
        },
        {
          name: "task_get",
          description: "Get a task item by id",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: { id: { type: "integer" } },
            required: ["id"],
          },
          handler: handleGet,
        },
        {
          name: "task_list",
          description: "List task items with optional list, status, and tag filters",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: {
              list_id: { type: "integer" },
              status: { type: "string", enum: ["pending", "completed", "all"] },
              tags: { type: "array", items: { type: "string" } },
              limit: { type: "integer" },
            },
          },
          handler: handleList,
        },
        {
          name: "tasklist_list",
          description: "List all task lists",
          exposeMcp: true,
          parameters: { type: "object", properties: {} },
          handler: () => handleListLists(),
        },
      ],
      TASK_TOOL_RETURNS,
    ),
  );
}

/** 供测试重置 */
export function resetTaskToolsForTests(): void {
  void getTaskFridgeBridge();
}
