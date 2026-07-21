import { omitUndefined } from "@freeanima/core/util";
import type { NotificationRow as PgNotificationRow } from "@freeanima/core/db/schema/rows";
import { resolveNotificationRecipients } from "@freeanima/core/config";
import { bindHabitatRouteHandlers } from "@freeanima/shared/habitat-contract/route.ts";
import type { NotificationRow } from "@freeanima/shared/rpc-contract/frames/notification";

import { notificationMethodDefs } from "../method-defs.ts";
import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type NotificationRemoteToolsServerDeps = {
  runtime: { runtimeDeps(): RuntimeDeps };
};

function depsOf(deps: unknown): NotificationRemoteToolsServerDeps {
  return deps as NotificationRemoteToolsServerDeps;
}

function serializeNotificationRow(row: PgNotificationRow): NotificationRow {
  return {
    id: row.id,
    recipient_kind: row.recipient_kind as NotificationRow["recipient_kind"],
    recipient_id: row.recipient_id,
    title: row.title,
    body: row.body,
    payload: row.payload,
    read_at: row.read_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
    source_kind: row.source_kind as NotificationRow["source_kind"],
    source_ref: row.source_ref,
  };
}

export const notificationHubRoutes = bindHabitatRouteHandlers(notificationMethodDefs, {
  "notification.list": async (deps, input) => {
    const result = await service.listNotifications(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined({
        recipient_kind: input.recipient_kind,
        recipient_id: input.recipient_id,
        read_filter: input.read_filter,
        offset: input.offset,
        limit: input.limit,
      }),
    );
    return {
      ...result,
      items: result.items.map(serializeNotificationRow),
    };
  },
  "notification.markRead": async (deps, input) => {
    const notification = await service.markNotificationRead(
      depsOf(deps).runtime.runtimeDeps(),
      input.id,
    );
    if (!notification) {
      throw new Error(`Notification not found: ${input.id}`);
    }
    return { ok: true as const, notification: serializeNotificationRow(notification) };
  },
  "notification.recipients": async (deps) => {
    const { user, agent } = resolveNotificationRecipients(
      depsOf(deps).runtime.runtimeDeps().engine.config.data,
    );
    return {
      user_subject_id: user.id,
      agent_subject_id: agent.id,
    };
  },
});
