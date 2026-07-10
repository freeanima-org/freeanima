import type { DreamEntryRowPayload } from "@freeanima/shared/sap-contract";
import { withOfflineCache } from "@freeanima/frontend/shell-sdk/offline-cache-first";
import { resolveHubCacheScope } from "@freeanima/frontend/shell-sdk/offline-cache";
import { getSatelliteHubClient } from "@freeanima/shared/hub-client";

export type DreamEntryRow = DreamEntryRowPayload;

function hub() {
  return getSatelliteHubClient();
}

export async function fetchDreamList(opts?: {
  offset?: number;
  limit?: number;
}): Promise<{ items: DreamEntryRow[]; total: number; offset: number; limit: number }> {
  const scope = resolveHubCacheScope();
  const cacheId = `list:${opts?.offset ?? 0}:${opts?.limit ?? 50}`;
  return withOfflineCache({
    scope,
    namespace: "dream",
    id: cacheId,
    fetch: async () =>
      hub().call("dream.list", {
        offset: opts?.offset,
        limit: opts?.limit,
      }),
    offlineError: "dream.list unavailable offline",
  });
}

export async function fetchDreamByDay(day: string): Promise<DreamEntryRow> {
  const scope = resolveHubCacheScope();
  const cacheId = `day:${day}`;
  return withOfflineCache({
    scope,
    namespace: "dream",
    id: cacheId,
    fetch: async () => {
      const data = await hub().call("dream.get", { day });
      return data.item;
    },
    offlineError: "dream.get unavailable offline",
  });
}
