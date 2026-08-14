import type { AnimaPresent } from "@freeanima/client/portal-sdk/anima-uri.ts";

const ITEM_PARAM = "item";
const PRESENT_PARAM = "present";

export type TaskItemUrlState = {
  itemId: number;
  present: AnimaPresent;
};

export function readTaskItemFromUrl(): TaskItemUrlState | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get(ITEM_PARAM)?.trim();
  if (!raw) return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  const presentRaw = params.get(PRESENT_PARAM);
  const present: AnimaPresent =
    presentRaw === "navigate" || presentRaw === "overlay" ? presentRaw : "overlay";
  return { itemId: id, present };
}

export function writeTaskItemToUrl(state: TaskItemUrlState | null): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete(ITEM_PARAM);
  url.searchParams.delete(PRESENT_PARAM);
  if (state) {
    url.searchParams.set(ITEM_PARAM, String(state.itemId));
    url.searchParams.set(PRESENT_PARAM, state.present);
  }
  window.history.replaceState(null, "", url);
}
