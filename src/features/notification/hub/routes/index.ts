import type { z } from "zod";

import {
  attachHandlersToDefs,
  type HubRouteHandler,
} from "@freeanima/shared/hub-contract/route.ts";
import { notificationMethodDefs } from "@freeanima/shared/hub-contract/registry/features.ts";

import {
  handleNotificationList,
  handleNotificationMarkRead,
  handleNotificationRecipients,
} from "../rpc.ts";

export const notificationHubRoutes = attachHandlersToDefs(notificationMethodDefs, {
  "notification.list": handleNotificationList,
  "notification.markRead": handleNotificationMarkRead,
  "notification.recipients": handleNotificationRecipients,
} as Record<keyof typeof notificationMethodDefs, HubRouteHandler<z.ZodTypeAny, z.ZodTypeAny>>);
