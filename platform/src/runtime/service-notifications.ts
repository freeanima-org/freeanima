import type {
  NotificationCreateInput,
  NotificationRecipientKind,
  NotificationReadFilter,
  NotificationRow,
} from "@freeanima/core/repos";
import { DEFAULT_NOTIFICATION_RECIPIENT_ID } from "@freeanima/core/repos";
import type { RuntimeDeps } from "./runtime-deps.ts";

export type NotificationListResult = {
  items: NotificationRow[];
  total: number;
  offset: number;
  limit: number;
};

function clampPagination(offset?: number, limit?: number) {
  const safeLimit = Math.max(1, Math.min(100, limit ?? 20));
  const safeOffset = Math.max(0, offset ?? 0);
  return { offset: safeOffset, limit: safeLimit };
}

function resolveRecipientId(recipientId?: string): string {
  const trimmed = recipientId?.trim();
  return trimmed || DEFAULT_NOTIFICATION_RECIPIENT_ID;
}

export async function listNotifications(
  deps: RuntimeDeps,
  args: {
    recipient_kind: NotificationRecipientKind;
    recipient_id?: string;
    read_filter?: NotificationReadFilter;
    offset?: number;
    limit?: number;
  },
): Promise<NotificationListResult> {
  const { offset, limit } = clampPagination(args.offset, args.limit);
  const filterOpts = {
    recipient_kind: args.recipient_kind,
    recipient_id: resolveRecipientId(args.recipient_id),
    read_filter: args.read_filter ?? "all",
  };
  const [items, total] = await Promise.all([
    deps.engine.repos.notifications.list({ ...filterOpts, offset, limit }),
    deps.engine.repos.notifications.count(filterOpts),
  ]);
  return { items, total, offset, limit };
}

export async function markNotificationRead(
  deps: RuntimeDeps,
  id: string,
): Promise<NotificationRow | null> {
  return deps.engine.repos.notifications.markRead(id.trim());
}

export async function createNotification(
  deps: RuntimeDeps,
  input: NotificationCreateInput,
): Promise<NotificationRow> {
  return deps.engine.repos.notifications.create({
    ...input,
    recipient_id: resolveRecipientId(input.recipient_id),
  });
}

export async function createNotificationForRecipients(
  deps: RuntimeDeps,
  input: Omit<NotificationCreateInput, "recipient_kind">,
  kinds: NotificationRecipientKind[],
): Promise<NotificationRow[]> {
  const rows: NotificationRow[] = [];
  for (const recipient_kind of kinds) {
    rows.push(
      await createNotification(deps, {
        ...input,
        recipient_kind,
      }),
    );
  }
  return rows;
}
