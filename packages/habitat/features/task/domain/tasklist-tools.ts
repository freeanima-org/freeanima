import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { attachToolReturns, toolError, toolResult } from "@freeanima/habitat/core/tool";
import { omitUndefined } from "@freeanima/habitat/core/util";

import {
  createTaskList,
  deleteTaskList,
  ensureDefaultTaskListForWorld,
  listTaskLists,
  searchTaskLists,
  updateTaskList,
} from "./list-store.ts";
import { TASK_TOOL_RETURNS } from "./return-schemas.ts";
import { listPayload } from "./task-tool-helpers.ts";
import { resolveTaskToolWorld, WORLD_ID_OPTIONAL } from "./tool-world-resolve.ts";
import type { TaskListUpdateInput } from "./types.ts";
import { coerceString } from "@freeanima/shared/coerce-string";

async function handleListLists(args: Record<string, unknown>): Promise<string> {
  const worldId = await resolveTaskToolWorld({ args });
  if (typeof worldId === "string") return worldId;

  await ensureDefaultTaskListForWorld(worldId);
  const includeClosed = args.include_closed === true;
  const lists = await listTaskLists(worldId, { includeClosed });
  return toolResult({
    ok: true,
    action: "list_lists",
    count: lists.length,
    lists: lists.map(listPayload),
  });
}

async function handleListCreate(args: Record<string, unknown>): Promise<string> {
  const parentIdRaw = args.parent_id;
  const hasParentId =
    parentIdRaw != null && parentIdRaw !== "" && Number.isFinite(Number(parentIdRaw));
  const worldId = await resolveTaskToolWorld({
    args,
    ...(hasParentId ? { listId: Number(parentIdRaw) } : {}),
    access: "write",
  });
  if (typeof worldId === "string") return worldId;

  const name = coerceString(args.name ?? "").trim();
  if (!name) return toolError("name is required");

  try {
    const list = await createTaskList(
      worldId,
      omitUndefined({
        name,
        sort_order: args.sort_order != null ? Number(args.sort_order) : undefined,
        color: args.color != null ? coerceString(args.color) : undefined,
        is_folder: args.is_folder === true,
        parent_id:
          args.parent_id == null
            ? null
            : args.parent_id != null
              ? Number(args.parent_id)
              : undefined,
      }),
    );
    return toolResult({ ok: true, action: "create_list", list: listPayload(list) });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleListUpdate(args: Record<string, unknown>): Promise<string> {
  const id = Number(args.id);
  if (!Number.isFinite(id) || id <= 0) return toolError("id is required");

  const worldId = await resolveTaskToolWorld({ args, entityId: id, access: "write" });
  if (typeof worldId === "string") return worldId;

  const patch: TaskListUpdateInput = { id };
  if (args.name !== undefined) patch.name = coerceString(args.name);
  if (args.sort_order !== undefined) patch.sort_order = Number(args.sort_order);
  if (args.closed !== undefined) patch.closed = Boolean(args.closed);
  if (args.color !== undefined) patch.color = coerceString(args.color);
  if (args.is_folder !== undefined) patch.is_folder = Boolean(args.is_folder);
  if (args.parent_id == null) patch.parent_id = null;
  else if (args.parent_id !== undefined) patch.parent_id = Number(args.parent_id);

  try {
    const result = await updateTaskList(worldId, patch);
    if (!result) return toolError("task list not found");
    return toolResult({
      ok: true,
      action: "update_list",
      list: listPayload(result),
    });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleListDelete(args: Record<string, unknown>): Promise<string> {
  const id = Number(args.id);
  if (!Number.isFinite(id) || id <= 0) return toolError("id is required");

  const worldId = await resolveTaskToolWorld({ args, entityId: id, access: "write" });
  if (typeof worldId === "string") return worldId;

  const cascade = args.cascade === true;

  try {
    const ok = await deleteTaskList(worldId, id, { cascade });
    if (!ok) return toolError("task list not found");
    return toolResult({ ok: true, action: "delete_list", id });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleListSearch(args: Record<string, unknown>): Promise<string> {
  const worldId = await resolveTaskToolWorld({ args });
  if (typeof worldId === "string") return worldId;

  const query = coerceString(args.query ?? "").trim();
  if (!query) return toolError("query is required");

  const limit =
    typeof args.limit === "number" && Number.isFinite(args.limit)
      ? Math.max(1, Math.min(50, Math.floor(args.limit)))
      : undefined;

  try {
    const lists = await searchTaskLists(worldId, omitUndefined({ query, limit }));
    return toolResult({
      ok: true,
      action: "search_lists",
      count: lists.length,
      lists: lists.map(listPayload),
    });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

const TASKLIST_TOOL_NAMES = [
  "tasklist_list",
  "tasklist_create",
  "tasklist_update",
  "tasklist_delete",
  "tasklist_search",
] as const;

export function registerTaskListTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "tasklist",
    "Task lists (CRUD and name search). Load toolset `task` for task items. world_id optional; id scopes infer world.",
    attachToolReturns(
      [
        {
          name: "tasklist_list",
          description: "List all task lists in caller default world",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              include_closed: {
                type: "boolean",
                description: "Include archived (closed) lists when true",
              },
            },
            required: ["subject_kind"],
          },
          handler: handleListLists,
        },
        {
          name: "tasklist_create",
          description: "Create a new task list",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              name: { type: "string", description: "List or folder name" },
              sort_order: { type: "integer" },
              color: { type: "string" },
              is_folder: {
                type: "boolean",
                description: "true to create a folder container (cannot hold tasks directly)",
              },
              parent_id: {
                type: "integer",
                description: "Parent folder entity id; omit for root level",
              },
            },
            required: ["subject_kind", "name"],
          },
          handler: handleListCreate,
        },
        {
          name: "tasklist_update",
          description: "Update task list name or settings",
          parameters: {
            type: "object",
            properties: {
              id: { type: "integer", description: "Task list id" },
              name: { type: "string", description: "New list name" },
              sort_order: { type: "integer" },
              closed: {
                type: "boolean",
                description:
                  "true to archive (close) the list; false to unarchive. Folders cannot be archived.",
              },
              color: { type: "string" },
              is_folder: {
                type: "boolean",
                description: "true for folder container; false to convert empty folder to list",
              },
              parent_id: {
                type: ["integer", "null"],
                description: "Parent folder id; null to move to root",
              },
            },
            required: ["subject_kind", "id"],
          },
          handler: handleListUpdate,
        },
        {
          name: "tasklist_delete",
          description:
            "Delete a task list (default inbox cannot be deleted). Deleting a folder removes all sub-folders and moves contained lists to root.",
          parameters: {
            type: "object",
            properties: {
              id: { type: "integer" },
              cascade: {
                type: "boolean",
                description: "Delete contained task items when true",
              },
            },
            required: ["subject_kind", "id"],
          },
          handler: handleListDelete,
        },
        {
          name: "tasklist_search",
          description: "Hybrid search task lists by name in caller default world",
          parameters: {
            type: "object",
            properties: {
              ...WORLD_ID_OPTIONAL,
              query: { type: "string", description: "Search keywords" },
              limit: { type: "integer", description: "Max results, default 30, cap 50" },
            },
            required: ["subject_kind", "query"],
          },
          handler: handleListSearch,
        },
      ],
      Object.fromEntries(TASKLIST_TOOL_NAMES.map((name) => [name, TASK_TOOL_RETURNS[name]])),
    ),
    { visibility: "searchable" },
  );
}
