import type { NotificationRow } from "@freeanima/habitat/core/db/schema/rows";

export const NOTIFICATION_RECIPIENT_KINDS = ["user", "agent"] as const;
export type NotificationRecipientKind = (typeof NOTIFICATION_RECIPIENT_KINDS)[number];

export const NOTIFICATION_READ_FILTERS = ["all", "unread"] as const;
export type NotificationReadFilter = (typeof NOTIFICATION_READ_FILTERS)[number];

export const NOTIFICATION_SOURCE_KINDS = ["system", "cron", "acp", "tool"] as const;
export type NotificationSourceKind = (typeof NOTIFICATION_SOURCE_KINDS)[number];

export const DEFAULT_NOTIFICATION_RECIPIENT_ID = "default";

export type { NotificationRow };

export type NotificationCreateInput = {
  recipient_kind: NotificationRecipientKind;
  recipient_id?: string;
  title: string;
  body: string;
  payload?: Record<string, unknown> | null;
  source_kind?: NotificationSourceKind | null;
  source_ref?: string | null;
};

export type NotificationListOpts = {
  recipient_kind: NotificationRecipientKind;
  recipient_id?: string;
  read_filter?: NotificationReadFilter;
  offset?: number;
  limit?: number;
};
