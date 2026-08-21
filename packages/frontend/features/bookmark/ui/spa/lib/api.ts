import type { BookmarkRowPayload } from "@freeanima/shared/rpc-contract/frames/bookmark.ts";
import { resolveHabitatCacheScope } from "@freeanima/client/portal-sdk/offline-cache";
import { withOfflineCache } from "@freeanima/client/portal-sdk/offline-cache-first";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";
import { invalidatePortalReads } from "@freeanima/client/portal-sdk/portal-query";

export type BookmarkRow = BookmarkRowPayload;

function habitat() {
  return getTypedHabitatClient();
}

export async function fetchBookmarks(
  subjectId: number,
  opts?: { parent_id?: number | null; query?: string; limit?: number },
): Promise<BookmarkRow[]> {
  const scope = resolveHabitatCacheScope();
  const q = opts?.query?.trim();
  const parentKey =
    opts?.parent_id === null ? "root" : opts?.parent_id != null ? String(opts.parent_id) : "all";
  const cacheId = q ? `search:${subjectId}:${q}` : `list:${subjectId}:${parentKey}`;

  return withOfflineCache({
    scope,
    namespace: "bookmark",
    id: cacheId,
    fetch: async () => {
      if (q) {
        const data = await habitat().call("bookmark.search", {
          subject_id: subjectId,
          query: q,
          limit: opts?.limit ?? 200,
        });
        return data.items;
      }
      const data = await habitat().call("bookmark.list", {
        subject_id: subjectId,
        ...(opts?.parent_id !== undefined ? { parent_id: opts.parent_id } : {}),
        limit: opts?.limit ?? 2000,
      });
      return data.items;
    },
    offlineError: "bookmark.list unavailable offline",
  });
}

export async function deleteBookmarkRemote(subjectId: number, id: number): Promise<void> {
  await habitat().call("bookmark.delete", { subject_id: subjectId, id });
  await invalidatePortalReads(["bookmark"]);
}

export async function patchBookmarkRemote(
  subjectId: number,
  id: number,
  patch: { title?: string; url?: string | null },
): Promise<BookmarkRow> {
  const data = await habitat().call("bookmark.patch", {
    subject_id: subjectId,
    id,
    ...patch,
  });
  await invalidatePortalReads(["bookmark"]);
  return data.item;
}
