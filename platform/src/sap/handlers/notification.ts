import { omitUndefined } from "@freeanima/core/util";
import {
  notificationListInputSchema,
  notificationMarkReadInputSchema,
} from "@freeanima/sap-contract";
import { resolveNotificationRecipients } from "@freeanima/core/config";
import type { SapServerDeps } from "../types.ts";
import * as serviceNotifications from "../../runtime/service-notifications.ts";

export async function handleNotificationList(deps: SapServerDeps, payload: unknown) {
  const input = notificationListInputSchema.parse(payload);
  return serviceNotifications.listNotifications(
    deps.runtime.runtimeDeps(),
    omitUndefined({
      recipient_kind: input.recipient_kind,
      recipient_id: input.recipient_id,
      read_filter: input.read_filter,
      offset: input.offset,
      limit: input.limit,
    }),
  );
}

export async function handleNotificationMarkRead(deps: SapServerDeps, payload: unknown) {
  const input = notificationMarkReadInputSchema.parse(payload);
  const notification = await serviceNotifications.markNotificationRead(
    deps.runtime.runtimeDeps(),
    input.id,
  );
  if (!notification) {
    throw new Error(`Notification not found: ${input.id}`);
  }
  return { ok: true as const, notification };
}

export function handleNotificationRecipients(deps: SapServerDeps) {
  const { user, agent } = resolveNotificationRecipients(
    deps.runtime.runtimeDeps().engine.config.data,
  );
  return {
    user_subject_id: user.id,
    agent_subject_id: agent.id,
  };
}
