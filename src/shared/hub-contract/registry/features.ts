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
import { z } from "zod";

import { defineHubMethod, dualCrudMeta } from "../method-def.ts";

const emptyInputSchema = z.object({}).passthrough();

export const emailMethodDefs = {
  "emailaccount.list": defineHubMethod({
    input: emailAccountListInputSchema,
    output: emailAccountListOutputSchema,
    meta: dualCrudMeta(undefined, true),
  }),
  "email.message.list": defineHubMethod({
    input: emailMessageListInputSchema,
    output: emailMessageListOutputSchema,
    meta: dualCrudMeta(undefined, true),
  }),
  "email.message.read": defineHubMethod({
    input: emailMessageReadInputSchema,
    output: emailMessageReadOutputSchema,
    meta: dualCrudMeta(undefined, true),
  }),
  "email.message.markRead": defineHubMethod({
    input: emailMessageMarkReadInputSchema,
    output: emailMessageMarkReadOutputSchema,
    meta: dualCrudMeta(undefined, false),
  }),
  "email.message.search": defineHubMethod({
    input: emailMessageSearchInputSchema,
    output: emailMessageSearchOutputSchema,
    meta: dualCrudMeta(undefined, true),
  }),
  "email.sync": defineHubMethod({
    input: emailSyncInputSchema,
    output: emailSyncOutputSchema,
    meta: dualCrudMeta(undefined, false),
  }),
  "emailthread.list": defineHubMethod({
    input: emailThreadListInputSchema,
    output: emailThreadListOutputSchema,
    meta: dualCrudMeta(undefined, true),
  }),
} as const;

export const diaryMethodDefs = {
  "diary.list": defineHubMethod({
    input: diaryListInputSchema,
    output: diaryListOutputSchema,
    meta: dualCrudMeta(undefined, true),
  }),
  "diary.create": defineHubMethod({
    input: diaryCreateInputSchema,
    output: diaryCreateOutputSchema,
    meta: dualCrudMeta(undefined, false),
  }),
  "diary.append": defineHubMethod({
    input: diaryAppendInputSchema,
    output: diaryAppendOutputSchema,
    meta: dualCrudMeta(undefined, false),
  }),
  "diary.patch": defineHubMethod({
    input: diaryPatchInputSchema,
    output: diaryPatchOutputSchema,
    meta: dualCrudMeta(undefined, false),
  }),
  "diary.delete": defineHubMethod({
    input: diaryDeleteInputSchema,
    output: diaryDeleteOutputSchema,
    meta: dualCrudMeta(undefined, false),
  }),
  "diary.get": defineHubMethod({
    input: diaryGetInputSchema,
    output: diaryGetOutputSchema,
    meta: dualCrudMeta(undefined, true),
  }),
  "diary.search": defineHubMethod({
    input: diarySearchInputSchema,
    output: diarySearchOutputSchema,
    meta: dualCrudMeta(undefined, true),
  }),
} as const;

export const dreamMethodDefs = {
  "dream.list": defineHubMethod({
    input: dreamListInputSchema,
    output: dreamListOutputSchema,
    meta: dualCrudMeta(undefined, true),
  }),
  "dream.get": defineHubMethod({
    input: dreamGetInputSchema,
    output: dreamGetOutputSchema,
    meta: dualCrudMeta(undefined, true),
  }),
} as const;

export const notificationMethodDefs = {
  "notification.list": defineHubMethod({
    input: notificationListInputSchema,
    output: notificationListOutputSchema,
    meta: dualCrudMeta(undefined, true),
  }),
  "notification.markRead": defineHubMethod({
    input: notificationMarkReadInputSchema,
    output: notificationMarkReadOutputSchema,
    meta: dualCrudMeta(undefined, false),
  }),
  "notification.recipients": defineHubMethod({
    input: emptyInputSchema,
    output: notificationRecipientsOutputSchema,
    meta: dualCrudMeta(undefined, true),
  }),
} as const;
