import { formatCstIso } from "@freeanima/kernel-util";
import { loadSessionMeta, updateSessionMetaField } from "./conversation.ts";
import type { PgRepositories } from "@freeanima/engine-repos";
import { isSessionMeta } from "./message.ts";
import {
  parseSessionTodoStore,
  todoStatusSchema,
  type SessionTodoStore,
  type TodoItem,
  type TodoStatus,
} from "./session-meta.ts";

export type { TodoStatus, TodoItem, SessionTodoStore };

const VALID_STATUSES = new Set<TodoStatus>(todoStatusSchema.options);

export async function loadSessionTodos(
  repos: PgRepositories,
  sessionId: string,
): Promise<SessionTodoStore> {
  const meta = await loadSessionMeta(repos, sessionId);
  return parseSessionTodoStore(isSessionMeta(meta) ? meta.todos : undefined);
}

export async function saveSessionTodos(
  repos: PgRepositories,
  sessionId: string,
  store: SessionTodoStore,
): Promise<void> {
  await updateSessionMetaField(repos, sessionId, { todos: store });
}

export async function listTodos(repos: PgRepositories, sessionId: string): Promise<string> {
  const data = await loadSessionTodos(repos, sessionId);
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

export async function addTodo(
  repos: PgRepositories,
  sessionId: string,
  content: string,
): Promise<string> {
  if (!content.trim()) return JSON.stringify({ error: "content is required" });
  const data = await loadSessionTodos(repos, sessionId);
  const item: TodoItem = {
    id: data.next_id,
    content: content.trim(),
    status: "pending",
    created_at: formatCstIso(),
  };
  data.items.push(item);
  data.next_id += 1;
  await saveSessionTodos(repos, sessionId, data);
  return `✓ 已添加 [#${item.id}] ${item.content}`;
}

export async function updateTodo(
  repos: PgRepositories,
  sessionId: string,
  id: number,
  status: TodoStatus,
): Promise<string> {
  if (!VALID_STATUSES.has(status)) {
    return JSON.stringify({ error: `invalid status ${status}` });
  }
  const data = await loadSessionTodos(repos, sessionId);
  for (const item of data.items) {
    if (item.id === id) {
      item.status = status;
      item.updated_at = formatCstIso();
      await saveSessionTodos(repos, sessionId, data);
      return `✓ [#${id}] → ${status}`;
    }
  }
  return JSON.stringify({ error: `todo #${id} not found` });
}

export async function deleteTodo(
  repos: PgRepositories,
  sessionId: string,
  id: number,
): Promise<string> {
  const data = await loadSessionTodos(repos, sessionId);
  const before = data.items.length;
  data.items = data.items.filter((item) => item.id !== id);
  if (data.items.length < before) {
    await saveSessionTodos(repos, sessionId, data);
    return `✓ 已删除 [#${id}]`;
  }
  return JSON.stringify({ error: `todo #${id} not found` });
}

export async function handleSessionTodo(
  repos: PgRepositories,
  sessionId: string,
  action: string,
  opts?: { content?: string; id?: number; status?: string },
): Promise<string> {
  switch (action) {
    case "list":
      return listTodos(repos, sessionId);
    case "add":
      return addTodo(repos, sessionId, opts?.content ?? "");
    case "update":
      if (opts?.id == null) return JSON.stringify({ error: "id is required" });
      if (!opts.status || !VALID_STATUSES.has(opts.status as TodoStatus)) {
        return JSON.stringify({ error: "valid status is required" });
      }
      return updateTodo(repos, sessionId, opts.id, opts.status as TodoStatus);
    case "delete":
      if (opts?.id == null) return JSON.stringify({ error: "id is required" });
      return deleteTodo(repos, sessionId, opts.id);
    default:
      return JSON.stringify({ error: `unknown action ${action}` });
  }
}
