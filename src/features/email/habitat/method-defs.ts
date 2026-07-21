import {
  emailAccountCreateInputSchema,
  emailAccountCreateOutputSchema,
  emailAccountDeleteInputSchema,
  emailAccountDeleteOutputSchema,
  emailAccountListInputSchema,
  emailAccountListOutputSchema,
  emailAccountPatchInputSchema,
  emailAccountPatchOutputSchema,
  emailMessageDeleteInputSchema,
  emailMessageDeleteOutputSchema,
  emailMessageListInputSchema,
  emailMessageListOutputSchema,
  emailMessageMarkReadInputSchema,
  emailMessageMarkReadOutputSchema,
  emailMessageMarkUnreadInputSchema,
  emailMessageMarkUnreadOutputSchema,
  emailMessageReadInputSchema,
  emailMessageReadOutputSchema,
  emailMessageSearchInputSchema,
  emailMessageSearchOutputSchema,
  emailProviderListInputSchema,
  emailProviderListOutputSchema,
  emailSendInputSchema,
  emailSendOutputSchema,
  emailSyncInputSchema,
  emailSyncOutputSchema,
  emailThreadListInputSchema,
  emailThreadListOutputSchema,
} from "@freeanima/shared/rpc-contract/frames/email";

import { defineHabitatMethod, dualTransportMeta } from "@freeanima/shared/habitat-contract";

export const emailMethodDefs = {
  "emailaccount.list": defineHabitatMethod({
    input: emailAccountListInputSchema,
    output: emailAccountListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "emailaccount.create": defineHabitatMethod({
    input: emailAccountCreateInputSchema,
    output: emailAccountCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "emailaccount.patch": defineHabitatMethod({
    input: emailAccountPatchInputSchema,
    output: emailAccountPatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "emailaccount.delete": defineHabitatMethod({
    input: emailAccountDeleteInputSchema,
    output: emailAccountDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "emailprovider.list": defineHabitatMethod({
    input: emailProviderListInputSchema,
    output: emailProviderListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "email.message.list": defineHabitatMethod({
    input: emailMessageListInputSchema,
    output: emailMessageListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "email.message.read": defineHabitatMethod({
    input: emailMessageReadInputSchema,
    output: emailMessageReadOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "email.message.markRead": defineHabitatMethod({
    input: emailMessageMarkReadInputSchema,
    output: emailMessageMarkReadOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "email.message.markUnread": defineHabitatMethod({
    input: emailMessageMarkUnreadInputSchema,
    output: emailMessageMarkUnreadOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "email.message.delete": defineHabitatMethod({
    input: emailMessageDeleteInputSchema,
    output: emailMessageDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "email.message.search": defineHabitatMethod({
    input: emailMessageSearchInputSchema,
    output: emailMessageSearchOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "email.send": defineHabitatMethod({
    input: emailSendInputSchema,
    output: emailSendOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "email.sync": defineHabitatMethod({
    input: emailSyncInputSchema,
    output: emailSyncOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "emailthread.list": defineHabitatMethod({
    input: emailThreadListInputSchema,
    output: emailThreadListOutputSchema,
    meta: dualTransportMeta(true),
  }),
} as const;
