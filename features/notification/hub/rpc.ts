import { omitUndefined } from "@freeanima/core/util";
import { resolveNotificationRecipients } from "@freeanima/core/config";
import {
  notificationListInputSchema,
  notificationMarkReadInputSchema,
  type SapRequestContext,
} from "../protocol/index.ts";
import type { RuntimeDeps } from "./runtime-deps.ts";
import * as serviceNotifications from "./service.ts";

/** Minimal SAP server deps for notification handlers (structural superset: platform SapServerDeps). */
export type NotificationSapServerDeps = {
  runtime: {
    runtimeDeps(): RuntimeDeps;
  };
};

export async function handleNotificationList(
  deps: NotificationSapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
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

export async function handleNotificationMarkRead(
  deps: NotificationSapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
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

export async function handleNotificationRecipients(
  deps: NotificationSapServerDeps,
  _payload: unknown,
  _ctx: SapRequestContext,
) {
  const { user, agent } = resolveNotificationRecipients(
    deps.runtime.runtimeDeps().engine.config.data,
  );
  return {
    user_subject_id: user.id,
    agent_subject_id: agent.id,
  };
}
