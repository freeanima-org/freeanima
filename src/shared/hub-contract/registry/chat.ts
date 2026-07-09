import {
  sessionAcpDockInputSchema,
  sessionAcpDockOutputSchema,
} from "@freeanima/shared/sap-contract/frames/acp";
import {
  conversationArchiveInputSchema,
  conversationCommandsInputSchema,
  conversationCommandsOutputSchema,
  conversationCreateInputSchema,
  conversationCreateOutputSchema,
  conversationDeleteInputSchema,
  conversationListInputSchema,
  conversationListOutputSchema,
  conversationMessagesInputSchema,
  conversationMutateOutputSchema,
  conversationPatchTitleInputSchema,
  conversationSubscribeInputSchema,
  conversationTailInputSchema,
  conversationTailOutputSchema,
  conversationUnarchiveInputSchema,
} from "@freeanima/shared/sap-contract/frames/conversation";
import {
  messageInterruptInputSchema,
  messageInterruptOutputSchema,
  messageSendInputSchema,
  messageSendOutputSchema,
} from "@freeanima/shared/sap-contract/frames/message";
import { z } from "zod";

import { defineHubMethod, dualTransportMeta, wsOnlyMeta } from "../method-def.ts";

const conversationMessagesOutputSchema = z.record(z.string(), z.unknown());
const conversationPatchTitleOutputSchema = z.object({ ok: z.literal(true) });
const conversationSubscribeOutputSchema = z.object({ ok: z.literal(true) });

export const chatMethodDefs = {
  "conversation.create": defineHubMethod({
    input: conversationCreateInputSchema,
    output: conversationCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "conversation.list": defineHubMethod({
    input: conversationListInputSchema,
    output: conversationListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "conversation.messages": defineHubMethod({
    input: conversationMessagesInputSchema,
    output: conversationMessagesOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "conversation.tail": defineHubMethod({
    input: conversationTailInputSchema,
    output: conversationTailOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "conversation.patchTitle": defineHubMethod({
    input: conversationPatchTitleInputSchema,
    output: conversationPatchTitleOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "conversation.archive": defineHubMethod({
    input: conversationArchiveInputSchema,
    output: conversationMutateOutputSchema,
    meta: wsOnlyMeta(),
  }),
  "conversation.unarchive": defineHubMethod({
    input: conversationUnarchiveInputSchema,
    output: conversationMutateOutputSchema,
    meta: wsOnlyMeta(),
  }),
  "conversation.delete": defineHubMethod({
    input: conversationDeleteInputSchema,
    output: conversationMutateOutputSchema,
    meta: wsOnlyMeta(),
  }),
  "conversation.rollbackBeforeLastUser": defineHubMethod({
    input: conversationDeleteInputSchema,
    output: conversationMutateOutputSchema,
    meta: wsOnlyMeta(),
  }),
  "conversation.subscribe": defineHubMethod({
    input: conversationSubscribeInputSchema,
    output: conversationSubscribeOutputSchema,
    meta: wsOnlyMeta(),
  }),
  "conversation.acpDock": defineHubMethod({
    input: sessionAcpDockInputSchema,
    output: sessionAcpDockOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "conversation.commands": defineHubMethod({
    input: conversationCommandsInputSchema,
    output: conversationCommandsOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "message.send": defineHubMethod({
    input: messageSendInputSchema,
    output: messageSendOutputSchema,
    meta: wsOnlyMeta(),
  }),
  "message.interrupt": defineHubMethod({
    input: messageInterruptInputSchema,
    output: messageInterruptOutputSchema,
    meta: wsOnlyMeta(),
  }),
} as const;
