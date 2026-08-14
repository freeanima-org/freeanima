import type { TaskModuleSelection } from "./task-smart-list-utils.ts";

const LIST_PARAM = "list";
const SMART_LIST_PARAM = "smart_list";
const SEARCH_PARAM = "search";

export function readTaskSelectionFromUrl(): TaskModuleSelection | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (params.has(SEARCH_PARAM)) {
    const raw = params.get(SEARCH_PARAM)?.trim();
    if (raw === "" || raw === "1" || raw === "true") {
      return { kind: "search" };
    }
  }
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
  url.searchParams.delete(SEARCH_PARAM);
  if (selection?.kind === "list") {
    url.searchParams.set(LIST_PARAM, String(selection.id));
  } else if (selection?.kind === "smart_list") {
    url.searchParams.set(SMART_LIST_PARAM, selection.key);
  } else if (selection?.kind === "search") {
    url.searchParams.set(SEARCH_PARAM, "1");
  }
  window.history.replaceState(null, "", url);
}
