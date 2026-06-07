import { toolError, toolResult } from "@freeanima/engine-tool";
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
  return toolResult({
    ok: true,
    todos: data.items,
    message: data.items.length ? `共 ${data.items.length} 条待办` : "暂无待办",
  });
}

export async function addTodo(
  repos: PgRepositories,
  sessionId: string,
  content: string,
): Promise<string> {
  if (!content.trim()) return toolError("content is required");
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
  return toolResult({
    ok: true,
    action: "add",
    todo: item,
    message: `已添加 [#${item.id}] ${item.content}`,
  });
}

export async function updateTodo(
  repos: PgRepositories,
  sessionId: string,
  id: number,
  status: TodoStatus,
): Promise<string> {
  if (!VALID_STATUSES.has(status)) {
    return toolError(`invalid status ${status}`);
  }
  const data = await loadSessionTodos(repos, sessionId);
  for (const item of data.items) {
    if (item.id === id) {
      item.status = status;
      item.updated_at = formatCstIso();
      await saveSessionTodos(repos, sessionId, data);
      return toolResult({
        ok: true,
        action: "update",
        id,
        status,
        message: `[#${id}] → ${status}`,
      });
    }
  }
  return toolError(`todo #${id} not found`);
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
    return toolResult({ ok: true, action: "delete", id, message: `已删除 [#${id}]` });
  }
  return toolError(`todo #${id} not found`);
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
      if (opts?.id == null) return toolError("id is required");
      if (!opts.status || !VALID_STATUSES.has(opts.status as TodoStatus)) {
        return toolError("valid status is required");
      }
      return updateTodo(repos, sessionId, opts.id, opts.status as TodoStatus);
    case "delete":
      if (opts?.id == null) return toolError("id is required");
      return deleteTodo(repos, sessionId, opts.id);
    default:
      return toolError(`unknown action ${action}`);
  }
}
