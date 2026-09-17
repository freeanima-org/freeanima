import type { BookmarkKind } from "@freeanima/shared/rpc-contract/frames/bookmark.ts";

export type BookmarkOutboxItem = {
  title: string;
  kind: BookmarkKind;
  url?: string | null;
  parent_browser_id?: string | null;
  sort_order?: number;
  browser_id: string;
  client_op_id?: string;
  deleted?: boolean;
};

const OUTBOX_KEY = "freeanima.bookmark_outbox";

export async function loadBookmarkOutbox(): Promise<BookmarkOutboxItem[]> {
  const data = await chrome.storage.local.get(OUTBOX_KEY);
  const raw = data[OUTBOX_KEY];
  return Array.isArray(raw) ? (raw as BookmarkOutboxItem[]) : [];
}

export async function enqueueBookmarkOutbox(item: BookmarkOutboxItem): Promise<void> {
  const prev = await loadBookmarkOutbox();
  const without = prev.filter(
    (x) => x.browser_id !== item.browser_id || Boolean(x.deleted) !== Boolean(item.deleted),
  );
  without.push(item);
  await chrome.storage.local.set({ [OUTBOX_KEY]: without.slice(-2000) });
}

export async function clearBookmarkOutbox(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const set = new Set(ids);
  const prev = await loadBookmarkOutbox();
  await chrome.storage.local.set({
    [OUTBOX_KEY]: prev.filter((x) => !set.has(x.browser_id)),
  });
}
