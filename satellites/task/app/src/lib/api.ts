import { whenSapClientReady } from "./sap-client.ts";

export type TaskListRow = {
  id: number;
  name: string;
  sort_order: number;
  closed: boolean;
  color: string | null;
  is_default: boolean;
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

export async function fetchTaskLists(): Promise<TaskListRow[]> {
  const client = await sap();
  const data = await client.request("tasklist.list", {});
  return data.lists;
}

export async function createTaskList(name: string): Promise<TaskListRow> {
  const client = await sap();
  const data = await client.request("tasklist.create", { name });
  return data.item;
}

export async function updateTaskList(
  id: number,
  patch: Partial<Pick<TaskListRow, "name" | "sort_order" | "closed" | "color">>,
): Promise<TaskListRow> {
  const client = await sap();
  const data = await client.request("tasklist.patch", { id, ...patch });
  return data.item;
}

export async function deleteTaskList(id: number): Promise<void> {
  const client = await sap();
  await client.request("tasklist.delete", { id, cascade: true });
}

export async function fetchTaskItems(listId: number): Promise<TaskItemRow[]> {
  const client = await sap();
  const data = await client.request("task.list", { list_id: listId, status: "all" });
  return data.items;
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
  const data = await client.request("task.create", input);
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
  const data = await client.request("task.patch", { id, ...patch });
  return data.item;
}

export async function completeTaskItem(id: number): Promise<TaskItemRow> {
  const client = await sap();
  const data = await client.request("task.complete", { id });
  return data.item;
}

export async function uncompleteTaskItem(id: number): Promise<TaskItemRow> {
  const client = await sap();
  const data = await client.request("task.uncomplete", { id });
  return data.item;
}

export async function deleteTaskItem(id: number): Promise<void> {
  const client = await sap();
  await client.request("task.delete", { id });
}
