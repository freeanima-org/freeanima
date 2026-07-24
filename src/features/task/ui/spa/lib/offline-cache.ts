import { readOfflineCache, writeOfflineCache } from "@freeanima/client/portal-sdk/offline-cache";

import type { TaskItemRow, TaskListRow } from "./api.ts";

export { resolveHabitatCacheScope } from "@freeanima/client/portal-sdk/offline-cache";

export async function readCachedTaskLists(scope: string): Promise<TaskListRow[] | null> {
  const raw = await readOfflineCache<TaskListRow[]>(scope, "tasks", "lists");
  return Array.isArray(raw) ? raw : null;
}

export async function writeCachedTaskLists(scope: string, lists: TaskListRow[]): Promise<void> {
  await writeOfflineCache(scope, "tasks", "lists", lists);
}

export async function readCachedTaskItems(
  scope: string,
  listId: number,
): Promise<TaskItemRow[] | null> {
  const raw = await readOfflineCache<TaskItemRow[]>(scope, "tasks", `items:${listId}`);
  return Array.isArray(raw) ? raw : null;
}

export async function writeCachedTaskItems(
  scope: string,
  listId: number,
  items: TaskItemRow[],
): Promise<void> {
  await writeOfflineCache(scope, "tasks", `items:${listId}`, items);
}
