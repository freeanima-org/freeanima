import {
  readOfflineCache,
  resolveHabitatCacheScope,
  writeOfflineCache,
} from "@freeanima/client/portal-sdk/offline-cache";
import type {
  NotificationCreatedEvent,
  NotificationListInput,
  NotificationListOutput,
  NotificationMarkReadOutput,
  NotificationRecipientsOutput,
} from "@freeanima/shared/rpc-contract";

import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";

export type NotificationRow = NotificationListOutput["items"][number];

function habitat() {
  return getTypedHabitatClient();
}

function cacheKey(input: NotificationListInput): string {
  return JSON.stringify(input);
}

export async function listNotifications(
  input: NotificationListInput,
): Promise<NotificationListOutput> {
  const scope = resolveHabitatCacheScope();
  const key = cacheKey(input);
  const cached = await readOfflineCache<NotificationListOutput>(scope, "notifications", key);
  try {
    const result = await habitat().call("notification.list", input);
    void writeOfflineCache(scope, "notifications", key, result);
    return result;
  } catch {
    if (cached) return cached;
    throw new Error("notification.list unavailable offline");
  }
}

export async function markNotificationRead(id: string): Promise<NotificationMarkReadOutput> {
  return habitat().call("notification.markRead", { id });
}

export async function getNotificationRecipients(): Promise<NotificationRecipientsOutput> {
  return habitat().call("notification.recipients", {});
}

/** 用户 Inbox 未读条数（Shell 导航角标；不走 offline cache） */
export async function getUnreadNotificationCount(): Promise<number> {
  const recipients = await habitat().call("notification.recipients", {});
  const result = await habitat().call("notification.list", {
    recipient_kind: "user",
    recipient_id: recipients.user_subject_id,
    read_filter: "unread",
    offset: 0,
    limit: 1,
  });
  return result.total;
}

/** 用户 Inbox 新建推送（本机提醒） */
export function subscribeUserNotificationInbox(
  onCreated: (event: NotificationCreatedEvent) => void,
): { unsubscribe: () => void } {
  return habitat().subscribe(
    "notification.subscribeInbox",
    {},
    {
      onData: (payload) => {
        const record = payload as Partial<NotificationCreatedEvent>;
        if (
          typeof record.id === "string" &&
          typeof record.title === "string" &&
          typeof record.body === "string"
        ) {
          onCreated({
            id: record.id,
            title: record.title,
            body: record.body,
            created_at: typeof record.created_at === "string" ? record.created_at : "",
          });
        }
      },
    },
  );
}
