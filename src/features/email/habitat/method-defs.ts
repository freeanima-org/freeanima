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
} from "@freeanima/shared/sap-contract/frames/email";

import { defineHubMethod, dualTransportMeta } from "@freeanima/shared/habitat-contract";

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
