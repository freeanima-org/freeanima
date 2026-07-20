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
} from "@freeanima/shared/sap-contract/frames/email";

import { defineHubMethod, dualTransportMeta } from "@freeanima/shared/habitat-contract";

export const emailMethodDefs = {
  "emailaccount.list": defineHubMethod({
    input: emailAccountListInputSchema,
    output: emailAccountListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "emailaccount.create": defineHubMethod({
    input: emailAccountCreateInputSchema,
    output: emailAccountCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "emailaccount.patch": defineHubMethod({
    input: emailAccountPatchInputSchema,
    output: emailAccountPatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "emailaccount.delete": defineHubMethod({
    input: emailAccountDeleteInputSchema,
    output: emailAccountDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "emailprovider.list": defineHubMethod({
    input: emailProviderListInputSchema,
    output: emailProviderListOutputSchema,
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
  "email.message.markUnread": defineHubMethod({
    input: emailMessageMarkUnreadInputSchema,
    output: emailMessageMarkUnreadOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "email.message.delete": defineHubMethod({
    input: emailMessageDeleteInputSchema,
    output: emailMessageDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "email.message.search": defineHubMethod({
    input: emailMessageSearchInputSchema,
    output: emailMessageSearchOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "email.send": defineHubMethod({
    input: emailSendInputSchema,
    output: emailSendOutputSchema,
    meta: dualTransportMeta(false),
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
