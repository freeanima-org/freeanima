import type { SmartListRow } from "./api.ts";
import { findSmartListRowByKey, type TaskModuleSelection } from "./task-smart-list-utils.ts";
import { readTaskSelectionFromUrl } from "./task-selection-url.ts";
import { resolveDefaultListId } from "./resolve-list.ts";
import type { TaskListRow } from "./api.ts";

function tryResolveCandidate(
  lists: TaskListRow[],
  smartLists: SmartListRow[],
  candidate: TaskModuleSelection,
): TaskModuleSelection | null {
  if (candidate.kind === "search") return { kind: "search" };
  if (candidate.kind === "list") {
    const row = lists.find((l) => l.id === candidate.id && !l.is_folder);
    return row ? { kind: "list", id: candidate.id } : null;
  }
  const row = findSmartListRowByKey(smartLists, candidate.key);
  return row ? { kind: "smart_list", key: candidate.key } : null;
}

export function resolveTaskSelection(
  lists: TaskListRow[],
  smartLists: SmartListRow[],
  options: {
    stored: TaskModuleSelection | null;
    urlSelection: TaskModuleSelection | null;
    preferUrl: boolean;
  },
): TaskModuleSelection {
  const candidates: TaskModuleSelection[] = [];
  if (options.preferUrl && options.urlSelection) candidates.push(options.urlSelection);
  if (options.stored && options.stored.kind !== "search") candidates.push(options.stored);
  if (!options.preferUrl && options.urlSelection) candidates.push(options.urlSelection);

  for (const candidate of candidates) {
    const resolved = tryResolveCandidate(lists, smartLists, candidate);
    if (resolved) return resolved;
  }

  const defaultListId = resolveDefaultListId(lists);
  if (defaultListId != null) return { kind: "list", id: defaultListId };

  return { kind: "search" };
}

export function parseStoredTaskSelection(raw: unknown): TaskModuleSelection | null {
  if (typeof raw === "number" && Number.isInteger(raw) && raw > 0) {
    return { kind: "list", id: raw };
  }
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (obj.kind === "list" && typeof obj.id === "number" && obj.id > 0) {
    return { kind: "list", id: obj.id };
  }
  if (obj.kind === "smart_list" && typeof obj.key === "string" && obj.key.trim()) {
    return { kind: "smart_list", key: obj.key.trim() };
  }
  if (obj.kind === "search") return { kind: "search" };
  return null;
}

export function readUrlTaskSelection(): TaskModuleSelection | null {
  return readTaskSelectionFromUrl();
}
