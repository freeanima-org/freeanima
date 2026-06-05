import { loadSessionMeta, updateSessionMetaField } from "@freeanima/engine-conversation";
import { isSessionMeta } from "@freeanima/legacy-kernel";
import {
  type SessionTodoStore,
  type TodoItem,
  type TodoStatus,
  parseSessionTodoStore,
  todoStatusSchema,
} from "@freeanima/legacy-kernel";

export type { TodoStatus, TodoItem, SessionTodoStore };

const VALID_STATUSES = new Set<TodoStatus>(todoStatusSchema.options);

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "+08:00");
}

export async function loadSessionTodos(sessionId: string): Promise<SessionTodoStore> {
  const meta = await loadSessionMeta(sessionId);
  return parseSessionTodoStore(isSessionMeta(meta) ? meta.todos : undefined);
}

export async function saveSessionTodos(sessionId: string, store: SessionTodoStore): Promise<void> {
  await updateSessionMetaField(sessionId, { todos: store });
}

export async function listTodos(sessionId: string): Promise<string> {
  const data = await loadSessionTodos(sessionId);
  if (!data.items.length) return "📋 暂无待办。";
  const lines = ["📋 待办清单："];
  const icons: Record<TodoStatus, string> = {
    pending: "○",
    in_progress: "◐",
    completed: "✓",
    cancelled: "✗",
  };
  for (const item of data.items) {
    const icon = icons[item.status] ?? "○";
    lines.push(`  [${String(item.id).padStart(3)}] ${icon} ${item.content}`);
  }
  return lines.join("\n");
}

export async function addTodo(sessionId: string, content: string): Promise<string> {
  if (!content.trim()) return JSON.stringify({ error: "content is required" });
  const data = await loadSessionTodos(sessionId);
  const item: TodoItem = {
    id: data.next_id,
    content: content.trim(),
    status: "pending",
    created_at: nowIso(),
  };
  data.items.push(item);
  data.next_id += 1;
  await saveSessionTodos(sessionId, data);
  return `✓ 已添加 [#${item.id}] ${item.content}`;
}

export async function updateTodo(
  sessionId: string,
  id: number,
  status: TodoStatus,
): Promise<string> {
  if (!VALID_STATUSES.has(status)) {
    return JSON.stringify({ error: `invalid status ${status}` });
  }
  const data = await loadSessionTodos(sessionId);
  for (const item of data.items) {
    if (item.id === id) {
      item.status = status;
      item.updated_at = nowIso();
      await saveSessionTodos(sessionId, data);
      return `✓ [#${id}] → ${status}`;
    }
  }
  return JSON.stringify({ error: `todo #${id} not found` });
}

export async function deleteTodo(sessionId: string, id: number): Promise<string> {
  const data = await loadSessionTodos(sessionId);
  const before = data.items.length;
  data.items = data.items.filter((item) => item.id !== id);
  if (data.items.length < before) {
    await saveSessionTodos(sessionId, data);
    return `✓ 已删除 [#${id}]`;
  }
  return JSON.stringify({ error: `todo #${id} not found` });
}

export async function handleSessionTodo(
  sessionId: string,
  action: string,
  opts?: { content?: string; id?: number; status?: string },
): Promise<string> {
  switch (action) {
    case "list":
      return listTodos(sessionId);
    case "add":
      return addTodo(sessionId, opts?.content ?? "");
    case "update":
      if (opts?.id == null) return JSON.stringify({ error: "id is required" });
      if (!opts.status || !VALID_STATUSES.has(opts.status as TodoStatus)) {
        return JSON.stringify({ error: "valid status is required" });
      }
      return updateTodo(sessionId, opts.id, opts.status as TodoStatus);
    case "delete":
      if (opts?.id == null) return JSON.stringify({ error: "id is required" });
      return deleteTodo(sessionId, opts.id);
    default:
      return JSON.stringify({ error: `unknown action ${action}` });
  }
}
