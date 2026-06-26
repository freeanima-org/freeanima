function resolveHubOrigin(): string {
  if (typeof window !== "undefined" && window.satelliteShell?.hubUrl) {
    return window.satelliteShell.hubUrl.replace(/\/$/, "");
  }
  return "http://127.0.0.1:2658";
}

async function taskFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${resolveHubOrigin()}/api${path}`;
  const fetchFn = window.satelliteShell?.hubFetch ?? fetch;
  return fetchFn(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

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

export async function fetchTaskLists(): Promise<TaskListRow[]> {
  const data = await parseJson<{ items: TaskListRow[] }>(await taskFetch("/task/lists"));
  return data.items;
}

export async function createTaskList(name: string): Promise<TaskListRow> {
  const data = await parseJson<{ item: TaskListRow }>(
    await taskFetch("/task/lists", { method: "POST", body: JSON.stringify({ name }) }),
  );
  return data.item;
}

export async function updateTaskList(
  id: number,
  patch: Partial<Pick<TaskListRow, "name" | "sort_order" | "closed" | "color">>,
): Promise<TaskListRow> {
  const data = await parseJson<{ item: TaskListRow }>(
    await taskFetch(`/task/lists/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  );
  return data.item;
}

export async function deleteTaskList(id: number): Promise<void> {
  await parseJson(await taskFetch(`/task/lists/${id}?cascade=true`, { method: "DELETE" }));
}

export async function fetchTaskItems(listId: number): Promise<TaskItemRow[]> {
  const data = await parseJson<{ items: TaskItemRow[] }>(
    await taskFetch(`/task/items?list_id=${listId}&status=all`),
  );
  return data.items;
}

export async function createTaskItem(input: {
  title: string;
  list_id: number;
  content?: string;
  tags?: string[];
  priority?: TaskItemRow["priority"];
  due_at?: string | null;
}): Promise<TaskItemRow> {
  const data = await parseJson<{ item: TaskItemRow }>(
    await taskFetch("/task/items", { method: "POST", body: JSON.stringify(input) }),
  );
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
  const data = await parseJson<{ item: TaskItemRow }>(
    await taskFetch(`/task/items/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  );
  return data.item;
}

export async function completeTaskItem(id: number): Promise<TaskItemRow> {
  const data = await parseJson<{ item: TaskItemRow }>(
    await taskFetch(`/task/items/${id}/complete`, { method: "POST", body: "{}" }),
  );
  return data.item;
}

export async function uncompleteTaskItem(id: number): Promise<TaskItemRow> {
  const data = await parseJson<{ item: TaskItemRow }>(
    await taskFetch(`/task/items/${id}/uncomplete`, { method: "POST", body: "{}" }),
  );
  return data.item;
}

export async function deleteTaskItem(id: number): Promise<void> {
  await parseJson(await taskFetch(`/task/items/${id}`, { method: "DELETE" }));
}
