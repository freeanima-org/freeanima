import type {
  NotificationListInput,
  NotificationListOutput,
  NotificationMarkReadOutput,
} from "@freeanima/sap-contract";

import { whenSapClientReady } from "../../../../../satellites/chat/app/src/lib/sap-client.ts";

export type NotificationRow = NotificationListOutput["items"][number];

export async function listNotifications(
  input: NotificationListInput,
): Promise<NotificationListOutput> {
  const client = await whenSapClientReady();
  return client.request("notification.list", input);
}

export async function markNotificationRead(id: string): Promise<NotificationMarkReadOutput> {
  const client = await whenSapClientReady();
  return client.request("notification.markRead", { id });
}
