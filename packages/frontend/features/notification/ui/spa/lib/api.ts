import { resolveHabitatCacheScope } from "@freeanima/client/portal-sdk/offline-cache";
import { withOfflineCache } from "@freeanima/client/portal-sdk/offline-cache-first";
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
  return withOfflineCache({
    scope,
    namespace: "notifications",
    id: key,
    fetch: async () => habitat().call("notification.list", input),
    offlineError: "notification.list unavailable offline",
  });
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
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- WS 事件载荷边界
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
