import {
  readOfflineCache,
  resolveHubCacheScope,
  writeOfflineCache,
} from "@freeanima/shell-sdk/offline-cache";
import type {
  NotificationListInput,
  NotificationListOutput,
  NotificationMarkReadOutput,
  NotificationRecipientsOutput,
} from "@freeanima/sap-contract";

import { whenSapClientReady } from "./hub-rpc.ts";

export type NotificationRow = NotificationListOutput["items"][number];

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
    const client = await whenSapClientReady();
    const result = await client.request("notification.list", input);
    void writeOfflineCache(scope, "notifications", key, result);
    return result;
  } catch {
    if (cached) return cached;
    throw new Error("notification.list unavailable offline");
  }
}

export async function markNotificationRead(id: string): Promise<NotificationMarkReadOutput> {
  const client = await whenSapClientReady();
  return client.request("notification.markRead", { id });
}

export async function getNotificationRecipients(): Promise<NotificationRecipientsOutput> {
  const client = await whenSapClientReady();
  return client.request("notification.recipients", {});
}
