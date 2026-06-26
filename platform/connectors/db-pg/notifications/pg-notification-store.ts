import type {
  NotificationCreateInput,
  NotificationListOpts,
  NotificationRow,
  NotificationStorePort,
} from "@freeanima/core/repos";

import * as crudRepo from "./repos/notification-crud-repo.ts";

/** PostgreSQL NotificationStorePort implementation */
export const pgNotificationStore: NotificationStorePort = {
  create: (input: NotificationCreateInput): Promise<NotificationRow> =>
    crudRepo.createNotification(input),
  list: (opts: NotificationListOpts): Promise<NotificationRow[]> =>
    crudRepo.listNotifications(opts),
  count: (opts: Omit<NotificationListOpts, "offset" | "limit">): Promise<number> =>
    crudRepo.countNotifications(opts),
  markRead: (id: string): Promise<NotificationRow | null> => crudRepo.markNotificationRead(id),
};
