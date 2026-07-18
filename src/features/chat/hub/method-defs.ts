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
  conversationCommandInputSchema,
  conversationCommandOutputSchema,
} from "@freeanima/shared/sap-contract/frames/conversation";
import {
  llmDebugGetInputSchema,
  llmDebugGetOutputSchema,
  messageInterruptInputSchema,
  messageInterruptOutputSchema,
  messageSendInputSchema,
  messageSendOutputSchema,
} from "@freeanima/shared/sap-contract/frames/message";
import { z } from "zod";

import { defineHubMethod, dualTransportMeta, wsOnlyMeta } from "@freeanima/shared/hub-contract";

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
  "conversation.command": defineHubMethod({
    input: conversationCommandInputSchema,
    output: conversationCommandOutputSchema,
    // 与 conversation.commands 一致走 HTTP，避免卫星默认 WS 时调试困难
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
  "llm_debug.get": defineHubMethod({
    input: llmDebugGetInputSchema,
    output: llmDebugGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
} as const;
