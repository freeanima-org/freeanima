import type { NotificationCreateInput } from "@freeanima/host/core/db/pg/notifications/types";
import { resolveNotificationRecipients } from "@freeanima/host/core/config";
import type { Config } from "@freeanima/host/core/config";
import {
  createNotification,
  listNotifications,
  markNotificationRead,
} from "@freeanima/features/notification/habitat/service";
import type { RuntimeDeps } from "./runtime-deps.ts";
import {
  markNotificationsReadBySourceRef,
  notificationExistsBySourceRef,
} from "@freeanima/host/core/db/pg/notifications";
import type {
  NotificationPort,
  NotificationRecipientRef,
} from "@freeanima/host/capabilities/tools/notification";

export function createNotificationPort(deps: RuntimeDeps, config: Config): NotificationPort {
  const recipients = resolveNotificationRecipients(config.data);

  return {
    getUserRecipient(): NotificationRecipientRef {
      return recipients.user;
    },
    getAgentRecipient(): NotificationRecipientRef {
      return recipients.agent;
    },
    create(input) {
      return createNotification(deps, input);
    },
    list(opts) {
      return listNotifications(deps, opts).then((result) => result.items);
    },
    markRead(id) {
      return markNotificationRead(deps, id);
    },
    markReadBySourceRef(sourceRef, recipient) {
      return markNotificationsReadBySourceRef(sourceRef, {
        recipient_kind: recipient.kind,
        recipient_id: recipient.id,
      });
    },
    existsBySourceRef(sourceRef, recipient) {
      return notificationExistsBySourceRef(sourceRef, {
        recipient_kind: recipient.kind,
        recipient_id: recipient.id,
      });
    },
  };
}

export async function notifyBothRecipients(
  deps: RuntimeDeps,
  config: Config,
  input: Omit<NotificationCreateInput, "recipient_kind" | "recipient_id">,
): Promise<void> {
  const { user, agent } = resolveNotificationRecipients(config.data);
  await createNotification(deps, { ...input, recipient_kind: user.kind, recipient_id: user.id });
  await createNotification(deps, { ...input, recipient_kind: agent.kind, recipient_id: agent.id });
}

export async function notifyAgentRecipient(
  deps: RuntimeDeps,
  config: Config,
  input: Omit<NotificationCreateInput, "recipient_kind" | "recipient_id">,
): Promise<void> {
  const { agent } = resolveNotificationRecipients(config.data);
  await createNotification(deps, { ...input, recipient_kind: agent.kind, recipient_id: agent.id });
}
