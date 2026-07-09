import type { TaskModuleSelection } from "./task-smart-list-utils.ts";

const LIST_PARAM = "list";
const SMART_LIST_PARAM = "smart_list";

export function readTaskSelectionFromUrl(): TaskModuleSelection | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const smartRaw = params.get(SMART_LIST_PARAM)?.trim();
  if (smartRaw) {
    return { kind: "smart_list", key: smartRaw };
  }
  const listRaw = params.get(LIST_PARAM)?.trim();
  if (!listRaw) return null;
  const id = Number(listRaw);
  return Number.isInteger(id) && id > 0 ? { kind: "list", id } : null;
}

export function writeTaskSelectionToUrl(selection: TaskModuleSelection | null): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete(LIST_PARAM);
  url.searchParams.delete(SMART_LIST_PARAM);
  if (selection?.kind === "list") {
    url.searchParams.set(LIST_PARAM, String(selection.id));
  } else if (selection?.kind === "smart_list") {
    url.searchParams.set(SMART_LIST_PARAM, selection.key);
  }
  window.history.replaceState(null, "", url);
}

/** @deprecated 使用 readTaskSelectionFromUrl */
export function readListIdFromUrl(): number | null {
  const sel = readTaskSelectionFromUrl();
  return sel?.kind === "list" ? sel.id : null;
}

/** @deprecated 使用 writeTaskSelectionToUrl */
export function writeListIdToUrl(listId: number | null): void {
  writeTaskSelectionToUrl(listId != null ? { kind: "list", id: listId } : null);
}
