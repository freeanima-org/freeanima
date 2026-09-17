const SYNC_KEY = "freeanima.bookmark_sync";

export type BookmarkSyncSettings = {
  enabled: boolean;
  last_pulled_updated_at: string | null;
  last_sync_at: string | null;
  last_error: string | null;
};

const DEFAULTS: BookmarkSyncSettings = {
  enabled: false,
  last_pulled_updated_at: null,
  last_sync_at: null,
  last_error: null,
};

export async function loadBookmarkSyncSettings(): Promise<BookmarkSyncSettings> {
  const data = await chrome.storage.local.get(SYNC_KEY);
  const raw = data[SYNC_KEY] as Partial<BookmarkSyncSettings> | undefined;
  return {
    enabled: raw?.enabled === true,
    last_pulled_updated_at: raw?.last_pulled_updated_at ?? null,
    last_sync_at: raw?.last_sync_at ?? null,
    last_error: raw?.last_error ?? null,
  };
}

export async function saveBookmarkSyncSettings(
  patch: Partial<BookmarkSyncSettings>,
): Promise<BookmarkSyncSettings> {
  const prev = await loadBookmarkSyncSettings();
  const next: BookmarkSyncSettings = { ...prev, ...patch };
  await chrome.storage.local.set({ [SYNC_KEY]: next });
  return next;
}
