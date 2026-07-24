import {
  notificationListInputSchema,
  notificationListOutputSchema,
  notificationMarkReadInputSchema,
  notificationMarkReadOutputSchema,
  notificationRecipientsOutputSchema,
  notificationSubscribeInboxInputSchema,
  notificationSubscribeInboxOutputSchema,
} from "@freeanima/shared/rpc-contract/frames/notification";
import { z } from "zod";

import {
  defineHabitatMethod,
  dualTransportMeta,
  wsOnlyMeta,
} from "@freeanima/shared/habitat-contract";

const emptyInputSchema = z.object({}).passthrough();

export const notificationMethodDefs = {
  "notification.list": defineHabitatMethod({
    input: notificationListInputSchema,
    output: notificationListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "notification.markRead": defineHabitatMethod({
    input: notificationMarkReadInputSchema,
    output: notificationMarkReadOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "notification.recipients": defineHabitatMethod({
    input: emptyInputSchema,
    output: notificationRecipientsOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "notification.subscribeInbox": defineHabitatMethod({
    input: notificationSubscribeInboxInputSchema,
    output: notificationSubscribeInboxOutputSchema,
    meta: wsOnlyMeta(),
  }),
} as const;
