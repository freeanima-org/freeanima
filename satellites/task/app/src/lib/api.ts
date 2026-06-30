import { fetchWorldContext, getSubjectKind, resolveWorldIdForSubject } from "@freeanima/shell-sdk";

import { entitySearchHitToTaskItem } from "./search-hit-mapper.ts";
import { whenSapClientReady } from "./sap-client.ts";

export type TaskListRow = {
  id: number;
  name: string;
  sort_order: number;
  closed: boolean;
  color: string | null;
  is_default: boolean;
  is_folder: boolean;
  parent_id: number | null;
  item_count: number;
  created_at: string;
  updated_at: string;
};

export type TaskItemRow = {
  id: number;
  title: string;
  content: string;
  tags: string[];
  status: "pending" | "completed";
  priority: "high" | "medium" | "low" | "none";
  due_at: string | null;
  list_id: number;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

async function sap() {
  return whenSapClientReady();
}

function withSubjectKind<T extends Record<string, unknown>>(payload: T) {
  return { subject_kind: getSubjectKind(), ...payload };
}

export async function fetchTaskLists(opts?: { includeClosed?: boolean }): Promise<TaskListRow[]> {
  const client = await sap();
  const data = await client.request(
    "tasklist.list",
    withSubjectKind({ include_closed: opts?.includeClosed }),
  );
  return data.lists;
}

export async function createTaskList(input: {
  name: string;
  is_folder?: boolean;
  parent_id?: number | null;
  sort_order?: number;
  color?: string | null;
}): Promise<TaskListRow> {
  const client = await sap();
  const data = await client.request("tasklist.create", withSubjectKind(input));
  return data.item;
}

export async function updateTaskList(
  id: number,
  patch: Partial<
    Pick<TaskListRow, "name" | "sort_order" | "closed" | "color" | "is_folder" | "parent_id">
  >,
): Promise<TaskListRow> {
  const client = await sap();
  const data = await client.request("tasklist.patch", withSubjectKind({ id, ...patch }));
  return data.item;
}

export async function closeTaskList(id: number): Promise<TaskListRow> {
  return updateTaskList(id, { closed: true });
}

export async function reopenTaskList(id: number): Promise<TaskListRow> {
  return updateTaskList(id, { closed: false });
}

export async function deleteTaskList(id: number): Promise<void> {
  const client = await sap();
  await client.request("tasklist.delete", withSubjectKind({ id, cascade: true }));
}

export async function fetchTaskItems(listId: number): Promise<TaskItemRow[]> {
  const client = await sap();
  const data = await client.request(
    "task.list",
    withSubjectKind({ list_id: listId, status: "all" }),
  );
  return data.items;
}

export async function searchTaskItems(input: {
  query: string;
  /** 限定单个清单；省略则搜索全部清单 */
  list_id?: number;
  status?: "pending" | "completed" | "all";
  limit?: number;
}): Promise<TaskItemRow[]> {
  const filters: Record<string, unknown> = {};
  if (input.list_id != null) filters.list_id = input.list_id;
  if (input.status && input.status !== "all") filters.status = input.status;

  const ctx = await fetchWorldContext();
  const world_id = resolveWorldIdForSubject(ctx, getSubjectKind());
  const res = await fetch("/api/entities/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: input.query,
      world_id,
      primary_component: "task_item",
      mode: "hybrid",
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      limit: input.limit ?? 30,
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `search failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    results: Array<{
      id: number;
      title: string;
      content?: string;
      body?: Record<string, unknown>;
      created_at?: string;
      updated_at?: string;
    }>;
  };
  return data.results
    .map((row) => entitySearchHitToTaskItem(row))
    .filter((row): row is TaskItemRow => row != null);
}

export async function createTaskItem(input: {
  title: string;
  list_id: number;
  content?: string;
  tags?: string[];
  priority?: TaskItemRow["priority"];
  due_at?: string | null;
  sort_order?: number;
}): Promise<TaskItemRow> {
  const client = await sap();
  const data = await client.request("task.create", withSubjectKind(input));
  return data.item;
}

export async function updateTaskItem(
  id: number,
  patch: Partial<
    Pick<
      TaskItemRow,
      "title" | "content" | "tags" | "priority" | "due_at" | "list_id" | "status" | "sort_order"
    >
  >,
): Promise<TaskItemRow> {
  const client = await sap();
  const data = await client.request("task.patch", withSubjectKind({ id, ...patch }));
  return data.item;
}

export async function completeTaskItem(id: number): Promise<TaskItemRow> {
  const client = await sap();
  const data = await client.request("task.complete", withSubjectKind({ id }));
  return data.item;
}

export async function uncompleteTaskItem(id: number): Promise<TaskItemRow> {
  const client = await sap();
  const data = await client.request("task.uncomplete", withSubjectKind({ id }));
  return data.item;
}

export async function deleteTaskItem(id: number): Promise<void> {
  const client = await sap();
  await client.request("task.delete", withSubjectKind({ id }));
}
