import {
  createTaskItem,
  createTaskList,
  deleteTaskItem,
  deleteTaskList,
  listTaskItems,
  listTaskLists,
  completeTaskItem,
  uncompleteTaskItem,
  updateTaskItem,
  updateTaskList,
} from "@freeanima/capabilities-task";
import { z } from "zod";

import { ApiHandlerError } from "./errors.ts";
import { adminCtx } from "./runtime.ts";

function assertPg(): void {
  if (!adminCtx().engine.repos.pgAvailable) {
    throw new ApiHandlerError(503, "PostgreSQL unavailable");
  }
}

const createListBodySchema = z.object({
  name: z.string().min(1),
  sort_order: z.number().int().optional(),
  color: z.string().nullable().optional(),
});

const updateListBodySchema = z.object({
  name: z.string().min(1).optional(),
  sort_order: z.number().int().optional(),
  closed: z.boolean().optional(),
  color: z.string().nullable().optional(),
});

const createItemBodySchema = z.object({
  title: z.string().min(1),
  list_id: z.number().int().positive(),
  priority: z.enum(["high", "medium", "low", "none"]).optional(),
  due_at: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  sort_order: z.number().int().optional(),
});

const updateItemBodySchema = z.object({
  title: z.string().min(1).optional(),
  list_id: z.number().int().positive().optional(),
  priority: z.enum(["high", "medium", "low", "none"]).optional(),
  due_at: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  sort_order: z.number().int().optional(),
  status: z.enum(["pending", "completed"]).optional(),
});

const listItemsQuerySchema = z.object({
  list_id: z.coerce.number().int().positive().optional(),
  status: z.enum(["pending", "completed", "all"]).optional(),
  due_today: z.coerce.boolean().optional(),
});

export async function getEntityTaskLists() {
  assertPg();
  const items = await listTaskLists();
  return { items };
}

export async function postEntityTaskList(body: unknown) {
  assertPg();
  const parsed = createListBodySchema.parse(body);
  const item = await createTaskList(parsed);
  return { item };
}

export async function patchEntityTaskList(id: number, body: unknown) {
  assertPg();
  const parsed = updateListBodySchema.parse(body);
  const item = await updateTaskList({ id, ...parsed });
  if (!item) throw new ApiHandlerError(404, "NOT_FOUND");
  return { item };
}

export async function removeEntityTaskList(id: number, cascade?: boolean) {
  assertPg();
  const ok = await deleteTaskList(id, { cascade: cascade ?? true });
  if (!ok) throw new ApiHandlerError(404, "NOT_FOUND");
  return { ok: true as const };
}

export async function getEntityTaskItems(query: unknown) {
  assertPg();
  const parsed = listItemsQuerySchema.parse(query ?? {});
  const items = await listTaskItems({
    list_id: parsed.list_id,
    status: parsed.status ?? "all",
    due_today: parsed.due_today,
  });
  return { items };
}

export async function postEntityTaskItem(body: unknown) {
  assertPg();
  const parsed = createItemBodySchema.parse(body);
  const item = await createTaskItem(parsed);
  return { item };
}

export async function patchEntityTaskItem(id: number, body: unknown) {
  assertPg();
  const parsed = updateItemBodySchema.parse(body);
  const item = await updateTaskItem({ id, ...parsed });
  if (!item) throw new ApiHandlerError(404, "NOT_FOUND");
  return { item };
}

export async function postEntityTaskItemComplete(id: number) {
  assertPg();
  const item = await completeTaskItem(id);
  if (!item) throw new ApiHandlerError(404, "NOT_FOUND");
  return { item };
}

export async function postEntityTaskItemUncomplete(id: number) {
  assertPg();
  const item = await uncompleteTaskItem(id);
  if (!item) throw new ApiHandlerError(404, "NOT_FOUND");
  return { item };
}

export async function removeEntityTaskItem(id: number) {
  assertPg();
  const ok = await deleteTaskItem(id);
  if (!ok) throw new ApiHandlerError(404, "NOT_FOUND");
  return { ok: true as const };
}
