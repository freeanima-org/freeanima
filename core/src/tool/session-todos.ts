import type { PgRepositories } from "@freeanima/core/repos";
import {
  isSessionMeta,
  parseSessionTodoStore,
  todoStatusSchema,
  type SessionTodoStore,
  type TodoItem,
  type TodoStatus,
} from "@freeanima/core/db/domain";
import { formatCstIso } from "@freeanima/core/util";
import { toolError, toolResult } from "./json-util.ts";

export type { TodoStatus, TodoItem, SessionTodoStore };

const VALID_STATUSES = new Set<TodoStatus>(todoStatusSchema.options);

async function loadSessionTodos(
  repos: PgRepositories,
  sessionId: string,
): Promise<SessionTodoStore> {
  if (!repos.pgAvailable) return parseSessionTodoStore(undefined);
  const meta = await repos.session.getSessionMeta(sessionId);
  return parseSessionTodoStore(meta && isSessionMeta(meta) ? meta.todos : undefined);
}

async function saveSessionTodos(
  repos: PgRepositories,
  sessionId: string,
  store: SessionTodoStore,
): Promise<void> {
  if (!repos.pgAvailable) return;
  await repos.session.patchSessionMeta(sessionId, { todos: store });
}

async function listTodos(repos: PgRepositories, sessionId: string): Promise<string> {
  const data = await loadSessionTodos(repos, sessionId);
  return toolResult({
    ok: true,
    todos: data.items,
    message: data.items.length ? `Total ${data.items.length} todo item(s)` : "No todos",
  });
}

async function addTodo(repos: PgRepositories, sessionId: string, content: string): Promise<string> {
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
    message: `Added [#${item.id}] ${item.content}`,
  });
}

async function updateTodo(
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

async function deleteTodo(repos: PgRepositories, sessionId: string, id: number): Promise<string> {
  const data = await loadSessionTodos(repos, sessionId);
  const before = data.items.length;
  data.items = data.items.filter((item) => item.id !== id);
  if (data.items.length < before) {
    await saveSessionTodos(repos, sessionId, data);
    return toolResult({ ok: true, action: "delete", id, message: `Deleted [#${id}]` });
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
