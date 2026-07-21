import {
  notificationListInputSchema,
  notificationListOutputSchema,
  notificationMarkReadInputSchema,
  notificationMarkReadOutputSchema,
  notificationRecipientsOutputSchema,
} from "@freeanima/shared/sap-contract/frames/notification";
import { z } from "zod";

import { defineHabitatMethod, dualTransportMeta } from "@freeanima/shared/habitat-contract";

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
} as const;
