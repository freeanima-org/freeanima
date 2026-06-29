import type { ToolSetRegistry } from "@freeanima/core/tool";
import { attachToolReturns, toolError, toolResult } from "@freeanima/core/tool";

import {
  completeTaskItem,
  createTaskItem,
  deleteTaskItem,
  listTaskItems,
  searchTaskItems,
  uncompleteTaskItem,
  updateTaskItem,
} from "./item-store.ts";
import { getDefaultTaskList } from "./list-store.ts";
import { TASK_TOOL_RETURNS } from "./return-schemas.ts";
import { itemPayload, parsePriority, parseTags, TASK_PRIORITIES } from "./task-tool-helpers.ts";
import type { TaskItemUpdateInput } from "./types.ts";

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
  const remindAt =
    args.remind_at != null && args.remind_at !== "" ? String(args.remind_at).trim() : null;
  const content = args.content != null ? String(args.content) : "";

  try {
    const item = await createTaskItem({
      title,
      content,
      tags,
      list_id: listId,
      priority,
      due_at: dueAt,
      remind_at: remindAt,
    });
    return toolResult({ ok: true, action: "create", item: itemPayload(item) });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleUpdate(args: Record<string, unknown>): Promise<string> {
  const id = Number(args.id);
  if (!Number.isFinite(id) || id <= 0) return toolError("id is required");

  const patch: TaskItemUpdateInput = { id };
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
  if (args.remind_at !== undefined) {
    patch.remind_at =
      args.remind_at != null && args.remind_at !== "" ? String(args.remind_at) : null;
  }
  if (args.sort_order !== undefined) patch.sort_order = Number(args.sort_order);

  try {
    const item = await updateTaskItem(patch);
    if (!item) return toolError(`task not found: ${id}`);
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

async function handleSearch(args: Record<string, unknown>): Promise<string> {
  const query = String(args.query ?? "").trim();
  if (!query) return toolError("query is required");

  const listIdRaw = args.list_id;
  const list_id =
    listIdRaw != null && listIdRaw !== "" && Number.isFinite(Number(listIdRaw))
      ? Number(listIdRaw)
      : undefined;
  const status =
    args.status === "completed" || args.status === "pending" || args.status === "all"
      ? args.status
      : undefined;
  const limit =
    typeof args.limit === "number" && Number.isFinite(args.limit)
      ? Math.max(1, Math.min(50, Math.floor(args.limit)))
      : undefined;

  try {
    const items = await searchTaskItems({
      query,
      list_id,
      status,
      limit,
    });
    return toolResult({
      ok: true,
      action: "search",
      count: items.length,
      items: items.map(itemPayload),
    });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

const TASK_ITEM_TOOL_NAMES = [
  "task_create",
  "task_update",
  "task_complete",
  "task_uncomplete",
  "task_delete",
  "task_get",
  "task_list",
  "task_search",
] as const;

export function registerTaskItemTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "task",
    "Task items (CRUD and hybrid search). Load toolset `tasklist` for list management.",
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
              priority: { type: "string", enum: TASK_PRIORITIES },
              due_at: { type: "string", description: "Due time ISO8601" },
              remind_at: { type: "string", description: "Reminder time ISO8601" },
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
              priority: { type: "string", enum: TASK_PRIORITIES },
              due_at: { type: "string" },
              remind_at: { type: "string" },
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
          name: "task_search",
          description:
            "Hybrid search task items by title/content. Omit list_id to search across all lists; pass list_id to scope to one list.",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search keywords" },
              list_id: {
                type: "integer",
                description: "Optional list id; omit to search all lists",
              },
              status: { type: "string", enum: ["pending", "completed", "all"] },
              limit: { type: "integer", description: "Max results, default 30, cap 50" },
            },
            required: ["query"],
          },
          handler: handleSearch,
        },
      ],
      Object.fromEntries(
        TASK_ITEM_TOOL_NAMES.map((name) => [name, TASK_TOOL_RETURNS[name]]),
      ) as Partial<typeof TASK_TOOL_RETURNS>,
    ),
  );
}
