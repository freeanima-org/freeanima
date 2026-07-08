import {
  diaryAppendInputSchema,
  diaryAppendOutputSchema,
  diaryCreateInputSchema,
  diaryCreateOutputSchema,
  diaryDeleteInputSchema,
  diaryDeleteOutputSchema,
  diaryGetInputSchema,
  diaryGetOutputSchema,
  diaryListInputSchema,
  diaryListOutputSchema,
  diaryPatchInputSchema,
  diaryPatchOutputSchema,
  diarySearchInputSchema,
  diarySearchOutputSchema,
} from "@freeanima/sap-contract/frames/diary";
import {
  dreamGetInputSchema,
  dreamGetOutputSchema,
  dreamListInputSchema,
  dreamListOutputSchema,
} from "@freeanima/sap-contract/frames/dream";
import {
  emailAccountListInputSchema,
  emailAccountListOutputSchema,
  emailMessageListInputSchema,
  emailMessageListOutputSchema,
  emailMessageMarkReadInputSchema,
  emailMessageMarkReadOutputSchema,
  emailMessageReadInputSchema,
  emailMessageReadOutputSchema,
  emailMessageSearchInputSchema,
  emailMessageSearchOutputSchema,
  emailSyncInputSchema,
  emailSyncOutputSchema,
  emailThreadListInputSchema,
  emailThreadListOutputSchema,
} from "@freeanima/sap-contract/frames/email";
import {
  notificationListInputSchema,
  notificationListOutputSchema,
  notificationMarkReadInputSchema,
  notificationMarkReadOutputSchema,
  notificationRecipientsOutputSchema,
} from "@freeanima/sap-contract/frames/notification";
import {
  companionConfigGetInputSchema,
  companionConfigGetOutputSchema,
  companionConfigUpdateInputSchema,
  companionConfigUpdateOutputSchema,
  companionMigrateFromLocalInputSchema,
  companionMigrateFromLocalOutputSchema,
  companionModelDeleteInputSchema,
  companionModelDeleteOutputSchema,
  companionModelRenameInputSchema,
  companionModelRenameOutputSchema,
  companionModelSetActiveInputSchema,
  companionModelSetActiveOutputSchema,
  companionMotionDeleteInputSchema,
  companionMotionDeleteOutputSchema,
  companionMotionRenameInputSchema,
  companionMotionRenameOutputSchema,
  companionMotionSetSlotInputSchema,
  companionMotionSetSlotOutputSchema,
  companionSyncPullInputSchema,
  companionSyncPullOutputSchema,
} from "@freeanima/sap-contract/frames/companion";
import { z } from "zod";

import { defineHubMethod, dualTransportMeta } from "../method-def.ts";

const emptyInputSchema = z.object({}).passthrough();

export const emailMethodDefs = {
  "emailaccount.list": defineHubMethod({
    input: emailAccountListInputSchema,
    output: emailAccountListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "email.message.list": defineHubMethod({
    input: emailMessageListInputSchema,
    output: emailMessageListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "email.message.read": defineHubMethod({
    input: emailMessageReadInputSchema,
    output: emailMessageReadOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "email.message.markRead": defineHubMethod({
    input: emailMessageMarkReadInputSchema,
    output: emailMessageMarkReadOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "email.message.search": defineHubMethod({
    input: emailMessageSearchInputSchema,
    output: emailMessageSearchOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "email.sync": defineHubMethod({
    input: emailSyncInputSchema,
    output: emailSyncOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "emailthread.list": defineHubMethod({
    input: emailThreadListInputSchema,
    output: emailThreadListOutputSchema,
    meta: dualTransportMeta(true),
  }),
} as const;

export const diaryMethodDefs = {
  "diary.list": defineHubMethod({
    input: diaryListInputSchema,
    output: diaryListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "diary.create": defineHubMethod({
    input: diaryCreateInputSchema,
    output: diaryCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "diary.append": defineHubMethod({
    input: diaryAppendInputSchema,
    output: diaryAppendOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "diary.patch": defineHubMethod({
    input: diaryPatchInputSchema,
    output: diaryPatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "diary.delete": defineHubMethod({
    input: diaryDeleteInputSchema,
    output: diaryDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "diary.get": defineHubMethod({
    input: diaryGetInputSchema,
    output: diaryGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "diary.search": defineHubMethod({
    input: diarySearchInputSchema,
    output: diarySearchOutputSchema,
    meta: dualTransportMeta(true),
  }),
} as const;

export const dreamMethodDefs = {
  "dream.list": defineHubMethod({
    input: dreamListInputSchema,
    output: dreamListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "dream.get": defineHubMethod({
    input: dreamGetInputSchema,
    output: dreamGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
} as const;

export const notificationMethodDefs = {
  "notification.list": defineHubMethod({
    input: notificationListInputSchema,
    output: notificationListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "notification.markRead": defineHubMethod({
    input: notificationMarkReadInputSchema,
    output: notificationMarkReadOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "notification.recipients": defineHubMethod({
    input: emptyInputSchema,
    output: notificationRecipientsOutputSchema,
    meta: dualTransportMeta(true),
  }),
} as const;

export const companionMethodDefs = {
  "companion.config.get": defineHubMethod({
    input: companionConfigGetInputSchema,
    output: companionConfigGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "companion.config.update": defineHubMethod({
    input: companionConfigUpdateInputSchema,
    output: companionConfigUpdateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.model.setActive": defineHubMethod({
    input: companionModelSetActiveInputSchema,
    output: companionModelSetActiveOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.model.rename": defineHubMethod({
    input: companionModelRenameInputSchema,
    output: companionModelRenameOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.model.delete": defineHubMethod({
    input: companionModelDeleteInputSchema,
    output: companionModelDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.motion.setSlot": defineHubMethod({
    input: companionMotionSetSlotInputSchema,
    output: companionMotionSetSlotOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.motion.rename": defineHubMethod({
    input: companionMotionRenameInputSchema,
    output: companionMotionRenameOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.motion.delete": defineHubMethod({
    input: companionMotionDeleteInputSchema,
    output: companionMotionDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.migrate.fromLocal": defineHubMethod({
    input: companionMigrateFromLocalInputSchema,
    output: companionMigrateFromLocalOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "companion.sync.pull": defineHubMethod({
    input: companionSyncPullInputSchema,
    output: companionSyncPullOutputSchema,
    meta: dualTransportMeta(true),
  }),
} as const;
