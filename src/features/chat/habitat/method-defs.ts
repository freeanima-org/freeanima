import {
  sessionAcpDockInputSchema,
  sessionAcpDockOutputSchema,
} from "@freeanima/shared/rpc-contract/frames/acp";
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
} from "@freeanima/shared/rpc-contract/frames/conversation";
import {
  llmDebugGetInputSchema,
  llmDebugGetOutputSchema,
  messageInterruptInputSchema,
  messageInterruptOutputSchema,
  messageSendInputSchema,
  messageSendOutputSchema,
  streamAttachInputSchema,
  streamAttachOutputSchema,
  streamLookupInputSchema,
  streamLookupOutputSchema,
} from "@freeanima/shared/rpc-contract/frames/message";
import { z } from "zod";

import {
  defineHabitatMethod,
  dualTransportMeta,
  wsOnlyMeta,
} from "@freeanima/shared/habitat-contract";

const conversationMessagesOutputSchema = z.record(z.string(), z.unknown());
const conversationPatchTitleOutputSchema = z.object({ ok: z.literal(true) });
const conversationSubscribeOutputSchema = z.object({ ok: z.literal(true) });

export const chatMethodDefs = {
  "conversation.create": defineHabitatMethod({
    input: conversationCreateInputSchema,
    output: conversationCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "conversation.list": defineHabitatMethod({
    input: conversationListInputSchema,
    output: conversationListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "conversation.messages": defineHabitatMethod({
    input: conversationMessagesInputSchema,
    output: conversationMessagesOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "conversation.tail": defineHabitatMethod({
    input: conversationTailInputSchema,
    output: conversationTailOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "conversation.patchTitle": defineHabitatMethod({
    input: conversationPatchTitleInputSchema,
    output: conversationPatchTitleOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "conversation.archive": defineHabitatMethod({
    input: conversationArchiveInputSchema,
    output: conversationMutateOutputSchema,
    meta: wsOnlyMeta(),
  }),
  "conversation.unarchive": defineHabitatMethod({
    input: conversationUnarchiveInputSchema,
    output: conversationMutateOutputSchema,
    meta: wsOnlyMeta(),
  }),
  "conversation.delete": defineHabitatMethod({
    input: conversationDeleteInputSchema,
    output: conversationMutateOutputSchema,
    meta: wsOnlyMeta(),
  }),
  "conversation.rollbackBeforeLastUser": defineHabitatMethod({
    input: conversationDeleteInputSchema,
    output: conversationMutateOutputSchema,
    meta: wsOnlyMeta(),
  }),
  "conversation.subscribe": defineHabitatMethod({
    input: conversationSubscribeInputSchema,
    output: conversationSubscribeOutputSchema,
    meta: wsOnlyMeta(),
  }),
  "conversation.acpDock": defineHabitatMethod({
    input: sessionAcpDockInputSchema,
    output: sessionAcpDockOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "conversation.commands": defineHabitatMethod({
    input: conversationCommandsInputSchema,
    output: conversationCommandsOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "conversation.command": defineHabitatMethod({
    input: conversationCommandInputSchema,
    output: conversationCommandOutputSchema,
    // 与 conversation.commands 一致走 HTTP，避免卫星默认 WS 时调试困难
    meta: dualTransportMeta(true),
  }),
  "message.send": defineHabitatMethod({
    input: messageSendInputSchema,
    output: messageSendOutputSchema,
    meta: wsOnlyMeta(),
  }),
  "message.interrupt": defineHabitatMethod({
    input: messageInterruptInputSchema,
    output: messageInterruptOutputSchema,
    meta: wsOnlyMeta(),
  }),
  "stream.attach": defineHabitatMethod({
    input: streamAttachInputSchema,
    output: streamAttachOutputSchema,
    meta: wsOnlyMeta(),
  }),
  "stream.lookup": defineHabitatMethod({
    input: streamLookupInputSchema,
    output: streamLookupOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "llm_debug.get": defineHabitatMethod({
    input: llmDebugGetInputSchema,
    output: llmDebugGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
} as const;
