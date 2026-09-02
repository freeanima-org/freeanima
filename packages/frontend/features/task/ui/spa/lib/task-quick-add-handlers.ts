import type { QuickAddSubmitPayload } from "@freeanima/ui-kit/composite";

import { createProjectTask } from "@freeanima/features/project/ui/spa/lib/api.ts";
import { searchTags } from "@freeanima/features/tag/ui/spa/lib/api.ts";

import { createTaskItem } from "./api.ts";
import { resolveDefaultListId } from "./resolve-list.ts";
import type { TaskListRow } from "./api.ts";
import { resolveSmartListDueAt } from "./resolve-smart-list-due.ts";
import type { SmartListRow } from "./api.ts";

export async function searchTaskQuickAddTags(query: string) {
  const rows = await searchTags(query, { limit: 20 });
  return rows.map((row) => ({ id: row.id, title: row.title }));
}
export function resolveQuickAddDefaultContainer(
  lists: TaskListRow[],
  selection: { kind: "list"; id: number } | { kind: "smart_list"; key: string } | null,
  selectedList: TaskListRow | null | undefined,
): { kind: "list"; id: number; label: string } | null {
  if (selection?.kind === "list" && selectedList != null && !selectedList.closed) {
    return { kind: "list", id: selectedList.id, label: selectedList.name };
  }
  const inboxId = resolveDefaultListId(lists);
  if (inboxId == null) return null;
  const inbox = lists.find((l) => l.id === inboxId);
  return { kind: "list", id: inboxId, label: inbox?.name ?? "收件箱" };
}

export async function submitTaskQuickAdd(input: {
  payload: QuickAddSubmitPayload;
  subjectId: number;
  lists: TaskListRow[];
  smartListRow: SmartListRow | null;
  fallbackListId: number | null;
}) {
  const { payload, subjectId, lists, smartListRow, fallbackListId } = input;
  const base = {
    title: payload.title,
    ...(payload.tagIds.length > 0 ? { tag_ids: payload.tagIds } : {}),
    ...(payload.priority !== "none" ? { priority: payload.priority } : {}),
    ...(payload.startAt ? { start_at: payload.startAt } : {}),
  };

  if (payload.container?.kind === "project") {
    return createProjectTask(subjectId, {
      ...base,
      project_id: payload.container.id,
    });
  }

  let listId = payload.container?.kind === "list" ? payload.container.id : fallbackListId;
  if (listId == null) {
    listId = resolveDefaultListId(lists);
  }
  if (listId == null) throw new Error("no target list");

  let due_at: string | null = null;
  if (!payload.startAt && smartListRow != null) {
    due_at = resolveSmartListDueAt(smartListRow.filters);
  }

  return createTaskItem({
    ...base,
    list_id: listId,
    ...(due_at ? { due_at } : {}),
  });
}
