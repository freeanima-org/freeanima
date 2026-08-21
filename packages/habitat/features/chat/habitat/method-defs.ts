import {
  conversationArchiveInputSchema,
  conversationCommandsInputSchema,
  conversationCommandsOutputSchema,
  conversationCreateInputSchema,
  conversationCreateOutputSchema,
  conversationDeleteInputSchema,
  conversationListInputSchema,
  conversationListOutputSchema,
  conversationMarkReadInputSchema,
  conversationMarkReadOutputSchema,
  conversationMessagesInputSchema,
  conversationMutateOutputSchema,
  conversationPatchTitleInputSchema,
  conversationPinInputSchema,
  conversationSubscribeInboxInputSchema,
  conversationSubscribeInputSchema,
  conversationTailInputSchema,
  conversationTailOutputSchema,
  conversationSetAgentInputSchema,
  conversationSetAgentOutputSchema,
  conversationUnarchiveInputSchema,
  conversationUnpinInputSchema,
  conversationUnreadCountInputSchema,
  conversationUnreadCountOutputSchema,
  conversationCommandInputSchema,
  conversationCommandOutputSchema,
} from "@freeanima/shared/rpc-contract/frames/conversation";
import {
  conversationShareCreateInputSchema,
  conversationShareCreateOutputSchema,
  conversationShareDeleteInputSchema,
  conversationShareDeleteOutputSchema,
  conversationShareGetInputSchema,
  conversationShareGetOutputSchema,
  conversationShareListInputSchema,
  conversationShareListOutputSchema,
} from "@freeanima/shared/rpc-contract/frames/conversation-share";
import {
  chatAttachmentUploadInputSchema,
  chatAttachmentUploadOutputSchema,
  llmDebugGetInputSchema,
  llmDebugGetOutputSchema,
  messageInterruptInputSchema,
  messageInterruptOutputSchema,
  messageContinueInputSchema,
  messageContinueOutputSchema,
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
  longOpMeta,
  wsOnlyMeta,
  binaryHttpMeta,
  publicHttpMeta,
} from "@freeanima/shared/habitat-contract";
import { HABITAT_RPC_BINARY_TRANSFER_TIMEOUT_MS } from "@freeanima/shared/habitat-rpc";

const conversationMessagesOutputSchema = z.record(z.string(), z.unknown());
const conversationPatchTitleOutputSchema = z.object({ ok: z.literal(true) });
const conversationSubscribeOutputSchema = z.object({ ok: z.literal(true) });

export const chatMethodDefs = {
  "conversation.create": defineHabitatMethod({
    input: conversationCreateInputSchema,
    output: conversationCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "conversation.setAgent": defineHabitatMethod({
    input: conversationSetAgentInputSchema,
    output: conversationSetAgentOutputSchema,
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
  "conversation.pin": defineHabitatMethod({
    input: conversationPinInputSchema,
    output: conversationMutateOutputSchema,
    meta: wsOnlyMeta(),
  }),
  "conversation.unpin": defineHabitatMethod({
    input: conversationUnpinInputSchema,
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
  "conversation.subscribeInbox": defineHabitatMethod({
    input: conversationSubscribeInboxInputSchema,
    output: conversationSubscribeOutputSchema,
    meta: wsOnlyMeta(),
  }),
  "conversation.markRead": defineHabitatMethod({
    input: conversationMarkReadInputSchema,
    output: conversationMarkReadOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "conversation.unreadCount": defineHabitatMethod({
    input: conversationUnreadCountInputSchema,
    output: conversationUnreadCountOutputSchema,
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
  "conversation.share.create": defineHabitatMethod({
    input: conversationShareCreateInputSchema,
    output: conversationShareCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "conversation.share.get": defineHabitatMethod({
    input: conversationShareGetInputSchema,
    output: conversationShareGetOutputSchema,
    meta: publicHttpMeta(),
  }),
  "conversation.share.list": defineHabitatMethod({
    input: conversationShareListInputSchema,
    output: conversationShareListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "conversation.share.delete": defineHabitatMethod({
    input: conversationShareDeleteInputSchema,
    output: conversationShareDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "message.send": defineHabitatMethod({
    input: messageSendInputSchema,
    output: messageSendOutputSchema,
    meta: wsOnlyMeta(),
  }),
  "message.continue": defineHabitatMethod({
    input: messageContinueInputSchema,
    output: messageContinueOutputSchema,
    meta: wsOnlyMeta(),
  }),
  "chat.attachment.upload": defineHabitatMethod({
    input: chatAttachmentUploadInputSchema,
    output: chatAttachmentUploadOutputSchema,
    meta: binaryHttpMeta({
      verb: "POST",
      path: "chat/attachment/upload",
      request: "multipart",
      timeoutMs: HABITAT_RPC_BINARY_TRANSFER_TIMEOUT_MS,
    }),
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
    meta: longOpMeta(true),
  }),
} as const;
