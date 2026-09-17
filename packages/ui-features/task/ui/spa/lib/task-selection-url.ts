import type { TaskModuleSelection } from "./task-smart-list-utils.ts";

const LIST_PARAM = "list";
const SMART_LIST_PARAM = "smart_list";
const SEARCH_PARAM = "search";

/** Web 用 location.search；原生 hash 路由查询在 `#/tasks?list=` 内。 */
export function readLocationSearchParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  const search = window.location.search;
  if (search) return new URLSearchParams(search);
  const hash = window.location.hash;
  const query = hash.includes("?") ? (hash.split("?")[1] ?? "") : "";
  return new URLSearchParams(query);
}

export function readTaskSelectionFromUrl(): TaskModuleSelection | null {
  if (typeof window === "undefined") return null;
  const params = readLocationSearchParams();
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

export function taskSelectionEquals(
  a: TaskModuleSelection | null | undefined,
  b: TaskModuleSelection | null | undefined,
): boolean {
  if (a == null || b == null) return a === b;
  if (a.kind !== b.kind) return false;
  if (a.kind === "list" && b.kind === "list") return a.id === b.id;
  if (a.kind === "smart_list" && b.kind === "smart_list") return a.key === b.key;
  return true;
}

export function writeTaskSelectionToUrl(selection: TaskModuleSelection | null): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const nativeHash = Boolean(window.portalShell?.isNativeShell) || url.hash.startsWith("#/");

  if (nativeHash) {
    const hash = url.hash || "#/";
    const [routePart, queryPart = ""] = hash.split("?");
    const route = routePart && routePart.length > 0 ? routePart : "#/";
    const params = new URLSearchParams(queryPart);
    params.delete(LIST_PARAM);
    params.delete(SMART_LIST_PARAM);
    params.delete(SEARCH_PARAM);
    if (selection?.kind === "list") {
      params.set(LIST_PARAM, String(selection.id));
    } else if (selection?.kind === "smart_list") {
      params.set(SMART_LIST_PARAM, selection.key);
    } else if (selection?.kind === "search") {
      params.set(SEARCH_PARAM, "1");
    }
    const qs = params.toString();
    const nextHash = qs ? `${route}?${qs}` : route;
    const next = `${url.pathname}${url.search}${nextHash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(null, "", next);
    }
    return;
  }

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
