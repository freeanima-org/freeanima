import {
  readOfflineCache,
  resolveHubCacheScope,
  writeOfflineCache,
} from "@freeanima/frontend/shell-sdk/offline-cache";
import type {
  NotificationListInput,
  NotificationListOutput,
  NotificationMarkReadOutput,
  NotificationRecipientsOutput,
} from "@freeanima/shared/sap-contract";

import { getTypedSatelliteHubClient } from "@freeanima/platform/hub/client.ts";

export type NotificationRow = NotificationListOutput["items"][number];

function hub() {
  return getTypedSatelliteHubClient();
}

function cacheKey(input: NotificationListInput): string {
  return JSON.stringify(input);
}

export async function listNotifications(
  input: NotificationListInput,
): Promise<NotificationListOutput> {
  const scope = resolveHubCacheScope();
  const key = cacheKey(input);
  const cached = await readOfflineCache<NotificationListOutput>(scope, "notifications", key);
  try {
    const result = await hub().call("notification.list", input);
    void writeOfflineCache(scope, "notifications", key, result);
    return result;
  } catch {
    if (cached) return cached;
    throw new Error("notification.list unavailable offline");
  }
}

export async function markNotificationRead(id: string): Promise<NotificationMarkReadOutput> {
  return hub().call("notification.markRead", { id });
}

export async function getNotificationRecipients(): Promise<NotificationRecipientsOutput> {
  return hub().call("notification.recipients", {});
}
