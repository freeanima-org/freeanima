import { asTaskItem } from "@freeanima/core/db/schema/entity";
import type { ToolSetRegistry } from "@freeanima/core/tool";
import { attachToolReturns, toolError, toolResult } from "@freeanima/core/tool";
import { getEntity } from "@freeanima/core/db/pg/entity";
import { omitUndefined } from "@freeanima/core/util";

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
import {
  itemPayload,
  parsePriority,
  parseTags,
  TASK_PRIORITIES,
  WORLD_ID_TOOL_PROPERTY,
} from "./task-tool-helpers.ts";
import { resolveTaskToolWorld } from "./tool-world-resolve.ts";
import type { TaskItemUpdateInput } from "./types.ts";

async function resolveListId(worldId: number, raw: unknown): Promise<number | null> {
  if (raw == null || raw === "") {
    const list = await getDefaultTaskList(worldId);
    return list.id;
  }
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function handleCreate(args: Record<string, unknown>): Promise<string> {
  const listIdRaw = args.list_id;
  const hasListId = listIdRaw != null && listIdRaw !== "";
  const worldId = await resolveTaskToolWorld({
    args,
    ...(hasListId ? { listId: Number(listIdRaw) } : {}),
    access: "write",
  });
  if (typeof worldId === "string") return worldId;

  const title = String(args.title ?? "").trim();
  if (!title) return toolError("title is required");

  const listId = await resolveListId(worldId, args.list_id);
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
  const projectIdRaw = args.project_id;
  const project_id =
    projectIdRaw != null && projectIdRaw !== "" && Number.isFinite(Number(projectIdRaw))
      ? Number(projectIdRaw)
      : undefined;
  const milestoneIdRaw = args.milestone_id;
  const milestone_id =
    milestoneIdRaw != null && milestoneIdRaw !== "" && Number.isFinite(Number(milestoneIdRaw))
      ? Number(milestoneIdRaw)
      : undefined;

  try {
    const item = await createTaskItem(
      worldId,
      omitUndefined({
        title,
        content,
        tags,
        list_id: listId,
        priority,
        due_at: dueAt,
        remind_at: remindAt,
        project_id,
        milestone_id,
      }),
    );
    return toolResult({ ok: true, action: "create", item: itemPayload(item) });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleUpdate(args: Record<string, unknown>): Promise<string> {
  const id = Number(args.id);
  if (!Number.isFinite(id) || id <= 0) return toolError("id is required");

  const worldId = await resolveTaskToolWorld({ args, entityId: id, access: "write" });
  if (typeof worldId === "string") return worldId;

  const patch: TaskItemUpdateInput = { id };
  if (args.title !== undefined) patch.title = String(args.title);
  if (args.content !== undefined) patch.content = String(args.content);
  if (args.tags !== undefined) {
    const tags = parseTags(args.tags);
    if (tags !== undefined) patch.tags = tags;
  }
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
  if (args.project_id !== undefined) {
    const raw = args.project_id;
    patch.project_id =
      raw == null || raw === "" ? null : Number.isFinite(Number(raw)) ? Number(raw) : null;
  }
  if (args.milestone_id !== undefined) {
    const raw = args.milestone_id;
    patch.milestone_id =
      raw == null || raw === "" ? null : Number.isFinite(Number(raw)) ? Number(raw) : null;
  }

  try {
    const item = await updateTaskItem(worldId, patch);
    if (!item) return toolError(`task not found: ${id}`);
    return toolResult({ ok: true, action: "update", item: itemPayload(item) });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleComplete(args: Record<string, unknown>, uncomplete: boolean): Promise<string> {
  const id = Number(args.id);
  if (!Number.isFinite(id) || id <= 0) return toolError("id is required");

  const worldId = await resolveTaskToolWorld({ args, entityId: id, access: "write" });
  if (typeof worldId === "string") return worldId;

  try {
    const item = uncomplete
      ? await uncompleteTaskItem(worldId, id)
      : await completeTaskItem(worldId, id);
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

  const worldId = await resolveTaskToolWorld({ args, entityId: id, access: "write" });
  if (typeof worldId === "string") return worldId;

  try {
    const ok = await deleteTaskItem(worldId, id);
    if (!ok) return toolError(`task not found: ${id}`);
    return toolResult({ ok: true, action: "delete", id });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleGet(args: Record<string, unknown>): Promise<string> {
  const id = Number(args.id);
  if (!Number.isFinite(id) || id <= 0) return toolError("id is required");

  const worldId = await resolveTaskToolWorld({ args, entityId: id });
  if (typeof worldId === "string") return worldId;

  const row = await getEntity(id);
  const parsed = row ? asTaskItem(row) : null;
  if (!parsed || !row || row.world_id !== worldId) {
    return toolError(`task not found: ${id}`);
  }
  const item = itemPayload({
    id: parsed.id,
    title: parsed.title,
    content: parsed.content,
    tags: parsed.tags ?? [],
    status: parsed.status,
    priority: parsed.priority,
    due_at: parsed.due_at ?? null,
    remind_at: parsed.remind_at ?? null,
    list_id: parsed.list_id,
    project_id: parsed.project_id ?? null,
    milestone_id: parsed.milestone_id ?? null,
    sort_order: parsed.sort_order ?? 0,
    completed_at: parsed.completed_at ?? null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  });
  return toolResult({ ok: true, action: "get", item });
}

async function handleList(args: Record<string, unknown>): Promise<string> {
  const listIdRaw = args.list_id;
  const hasListId = listIdRaw != null && listIdRaw !== "" && Number.isFinite(Number(listIdRaw));
  const projectIdRaw = args.project_id;
  const hasProjectId =
    projectIdRaw != null && projectIdRaw !== "" && Number.isFinite(Number(projectIdRaw));
  if (hasListId && hasProjectId) {
    return toolError("project_id and list_id are mutually exclusive");
  }

  const worldId = await resolveTaskToolWorld({
    args,
    ...(hasListId ? { listId: Number(listIdRaw) } : {}),
    ...(hasProjectId ? { entityId: Number(projectIdRaw) } : {}),
  });
  if (typeof worldId === "string") return worldId;

  const listId = hasListId ? Number(listIdRaw) : undefined;
  const projectId = hasProjectId ? Number(projectIdRaw) : undefined;
  const status =
    args.status === "completed" || args.status === "pending" || args.status === "all"
      ? args.status
      : "pending";
  const tags = parseTags(args.tags);
  const limit = typeof args.limit === "number" ? args.limit : 50;

  const items = await listTaskItems(worldId, {
    ...(listId !== undefined ? { list_id: listId } : {}),
    ...(projectId !== undefined ? { project_id: projectId } : {}),
    status,
    ...(tags !== undefined ? { tags } : {}),
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
  const hasListId = listIdRaw != null && listIdRaw !== "" && Number.isFinite(Number(listIdRaw));
  const projectIdRaw = args.project_id;
  const hasProjectId =
    projectIdRaw != null && projectIdRaw !== "" && Number.isFinite(Number(projectIdRaw));
  if (hasListId && hasProjectId) {
    return toolError("project_id and list_id are mutually exclusive");
  }

  const worldId = await resolveTaskToolWorld({
    args,
    ...(hasListId ? { listId: Number(listIdRaw) } : {}),
    ...(hasProjectId ? { entityId: Number(projectIdRaw) } : {}),
  });
  if (typeof worldId === "string") return worldId;

  const list_id = hasListId ? Number(listIdRaw) : undefined;
  const project_id = hasProjectId ? Number(projectIdRaw) : undefined;
  const status =
    args.status === "completed" || args.status === "pending" || args.status === "all"
      ? args.status
      : undefined;
  const limit =
    typeof args.limit === "number" && Number.isFinite(args.limit)
      ? Math.max(1, Math.min(50, Math.floor(args.limit)))
      : undefined;

  try {
    const items = await searchTaskItems(
      worldId,
      omitUndefined({
        query,
        list_id,
        project_id,
        status,
        limit,
      }),
    );
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

const WORLD_ID_OPTIONAL = {
  world_id: {
    ...WORLD_ID_TOOL_PROPERTY,
    description:
      "Optional world override; defaults to caller subject private world (MCP token subject or agent subject for LLM)",
  },
} as const;

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
    "Task items (CRUD and hybrid search). Load toolset `tasklist` for list management. world_id optional; id/list_id/project_id scopes infer world.",
    attachToolReturns(
      [
        {
          name: "task_create",
          description: "Create a task item in a list (default list when list_id omitted)",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              title: { type: "string", description: "Task title" },
              content: { type: "string", description: "Task body / details" },
              tags: {
                type: "array",
                items: { type: "string" },
                description: "Optional tags",
              },
              list_id: { type: "integer", description: "Target list id (default inbox)" },
              project_id: { type: "integer", description: "Assign to project (optional)" },
              milestone_id: { type: "integer", description: "Link to milestone in project" },
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
              project_id: {
                type: "integer",
                description: "Move to project; null to return to Backlog",
              },
              milestone_id: { type: "integer", description: "Optional milestone in project" },
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
          description:
            "List task items with optional list, project, status, and tag filters. Default (no project_id) is Backlog only. project_id lists in-project tasks; mutually exclusive with list_id. list_id/project_id scopes world; omit for caller default world.",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              list_id: { type: "integer" },
              project_id: {
                type: "integer",
                description: "Filter by project; mutually exclusive with list_id",
              },
              status: { type: "string", enum: ["pending", "completed", "all"] },
              tags: { type: "array", items: { type: "string" } },
              limit: { type: "integer" },
            },
            required: [],
          },
          handler: handleList,
        },
        {
          name: "task_search",
          description:
            "Hybrid search task items by title/content. Optional list_id or project_id (mutually exclusive) scopes filter and world; omit both to search caller default world.",
          exposeMcp: true,
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              query: { type: "string", description: "Search keywords" },
              list_id: {
                type: "integer",
                description: "Optional list id; scopes world when set",
              },
              project_id: {
                type: "integer",
                description: "Filter by project; mutually exclusive with list_id",
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
