const LIST_PARAM = "list";

export function readListIdFromUrl(): number | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get(LIST_PARAM)?.trim();
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function writeListIdToUrl(listId: number | null): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (listId != null) url.searchParams.set(LIST_PARAM, String(listId));
  else url.searchParams.delete(LIST_PARAM);
  window.history.replaceState(null, "", url);
}
