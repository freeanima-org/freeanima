import type {
  NotificationCreateInput,
  NotificationListOpts,
  NotificationRow,
  NotificationStorePort,
} from "../ports/notification.ts";

import { pgUnavailableStore } from "./null-helpers.ts";

function notConfigured(): never {
  return pgUnavailableStore("NotificationStore");
}

export const nullNotificationStore: NotificationStorePort = {
  async create(_input: NotificationCreateInput): Promise<NotificationRow> {
    return notConfigured();
  },
  async list(_opts: NotificationListOpts): Promise<NotificationRow[]> {
    return notConfigured();
  },
  async count(_opts: Omit<NotificationListOpts, "offset" | "limit">): Promise<number> {
    return notConfigured();
  },
  async markRead(_id: string): Promise<NotificationRow | null> {
    return notConfigured();
  },
};
