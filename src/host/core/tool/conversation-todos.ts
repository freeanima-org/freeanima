import {
  isConversationMeta,
  parseConversationTodoStore,
  todoStatusSchema,
  type ConversationTodoStore,
  type TodoItem,
  type TodoStatus,
} from "@freeanima/host/core/db/domain";
import { isPostgresPrimary } from "@freeanima/host/core/db/pg";
import {
  getConversationMeta,
  patchConversationMeta,
} from "@freeanima/host/core/db/pg/conversation";
import { formatCstIso } from "@freeanima/host/core/util";
import { toolError, toolResult } from "./json-util.ts";

export type { TodoStatus, TodoItem, ConversationTodoStore };

const VALID_STATUSES = new Set<TodoStatus>(todoStatusSchema.options);

async function loadSessionTodos(conversationId: string): Promise<ConversationTodoStore> {
  if (!isPostgresPrimary()) return parseConversationTodoStore(undefined);
  const meta = await getConversationMeta(conversationId);
  return parseConversationTodoStore(meta && isConversationMeta(meta) ? meta.todos : undefined);
}

async function saveSessionTodos(
  conversationId: string,
  store: ConversationTodoStore,
): Promise<void> {
  if (!isPostgresPrimary()) return;
  await patchConversationMeta(conversationId, { todos: store });
}

async function listTodos(conversationId: string): Promise<string> {
  const data = await loadSessionTodos(conversationId);
  return toolResult({
    ok: true,
    todos: data.items,
    message: data.items.length > 0 ? `Total ${data.items.length} todo item(s)` : "No todos",
  });
}

async function addTodo(conversationId: string, content: string): Promise<string> {
  if (!content.trim()) return toolError("content is required");
  const data = await loadSessionTodos(conversationId);
  const item: TodoItem = {
    id: data.next_id,
    content: content.trim(),
    status: "pending",
    created_at: formatCstIso(),
  };
  data.items.push(item);
  data.next_id += 1;
  await saveSessionTodos(conversationId, data);
  return toolResult({
    ok: true,
    action: "add",
    todo: item,
    message: `Added [#${item.id}] ${item.content}`,
  });
}

async function updateTodo(conversationId: string, id: number, status: TodoStatus): Promise<string> {
  if (!VALID_STATUSES.has(status)) {
    return toolError(`invalid status ${status}`);
  }
  const data = await loadSessionTodos(conversationId);
  for (const item of data.items) {
    if (item.id === id) {
      item.status = status;
      item.updated_at = formatCstIso();
      await saveSessionTodos(conversationId, data);
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

async function deleteTodo(conversationId: string, id: number): Promise<string> {
  const data = await loadSessionTodos(conversationId);
  const before = data.items.length;
  data.items = data.items.filter((item) => item.id !== id);
  if (data.items.length < before) {
    await saveSessionTodos(conversationId, data);
    return toolResult({ ok: true, action: "delete", id, message: `Deleted [#${id}]` });
  }
  return toolError(`todo #${id} not found`);
}

export async function handleConversationTodo(
  conversationId: string,
  action: string,
  opts?: { content?: string; id?: number; status?: string },
): Promise<string> {
  switch (action) {
    case "list":
      return listTodos(conversationId);
    case "add":
      return addTodo(conversationId, opts?.content ?? "");
    case "update":
      if (opts?.id == null) return toolError("id is required");
      if (!opts.status || !VALID_STATUSES.has(opts.status as TodoStatus)) {
        return toolError("valid status is required");
      }
      return updateTodo(conversationId, opts.id, opts.status as TodoStatus);
    case "delete":
      if (opts?.id == null) return toolError("id is required");
      return deleteTodo(conversationId, opts.id);
    default:
      return toolError(`unknown action ${action}`);
  }
}
