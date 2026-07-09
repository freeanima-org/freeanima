import type { SmartListRow } from "./api.ts";
import {
  DEFAULT_SMART_LIST_KEY,
  findSmartListRowByKey,
  type TaskModuleSelection,
} from "./task-smart-list-utils.ts";
import { readTaskSelectionFromUrl } from "./task-selection-url.ts";
import { resolveDefaultListId } from "./resolve-list.ts";
import type { TaskListRow } from "./api.ts";

export function resolveTaskSelection(
  lists: TaskListRow[],
  smartLists: SmartListRow[],
  options: {
    stored: TaskModuleSelection | null;
    urlSelection: TaskModuleSelection | null;
    preferUrl: boolean;
  },
): TaskModuleSelection {
  const tryList = (id: number | null | undefined): TaskModuleSelection | null => {
    if (id == null) return null;
    const row = lists.find((l) => l.id === id && !l.is_folder);
    return row ? { kind: "list", id } : null;
  };

  const trySmartList = (key: string | null | undefined): TaskModuleSelection | null => {
    if (!key) return null;
    const row = findSmartListRowByKey(smartLists, key);
    return row ? { kind: "smart_list", key } : null;
  };

  if (options.preferUrl && options.urlSelection) {
    if (options.urlSelection.kind === "list") {
      const fromUrl = tryList(options.urlSelection.id);
      if (fromUrl) return fromUrl;
    } else {
      const fromUrl = trySmartList(options.urlSelection.key);
      if (fromUrl) return fromUrl;
    }
  }

  if (options.stored) {
    if (options.stored.kind === "list") {
      const fromStored = tryList(options.stored.id);
      if (fromStored) return fromStored;
    } else {
      const fromStored = trySmartList(options.stored.key);
      if (fromStored) return fromStored;
    }
  }

  if (!options.preferUrl && options.urlSelection) {
    if (options.urlSelection.kind === "list") {
      const fromUrl = tryList(options.urlSelection.id);
      if (fromUrl) return fromUrl;
    } else {
      const fromUrl = trySmartList(options.urlSelection.key);
      if (fromUrl) return fromUrl;
    }
  }

  const fallbackSmart = trySmartList(DEFAULT_SMART_LIST_KEY);
  if (fallbackSmart) return fallbackSmart;

  const defaultListId = resolveDefaultListId(lists);
  if (defaultListId != null) return { kind: "list", id: defaultListId };

  return { kind: "smart_list", key: DEFAULT_SMART_LIST_KEY };
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
  return null;
}

export function readUrlTaskSelection(): TaskModuleSelection | null {
  return readTaskSelectionFromUrl();
}
