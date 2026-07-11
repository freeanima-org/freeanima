import type { z } from "zod";

import {
  attachHandlersToDefs,
  type HubRouteHandler,
} from "@freeanima/shared/hub-contract/route.ts";
import { chatMethodDefs } from "@freeanima/shared/hub-contract/registry/chat.ts";

import {
  handleConversationAcpDock,
  handleConversationArchive,
  handleConversationCommands,
  handleConversationCreate,
  handleConversationDelete,
  handleConversationList,
  handleConversationMessages,
  handleConversationPatchTitle,
  handleConversationRollbackBeforeLastUser,
  handleConversationSubscribe,
  handleConversationTail,
  handleConversationUnarchive,
  handleMessageInterrupt,
  handleMessageSend,
} from "../rpc.ts";

export const chatHubRoutes = attachHandlersToDefs(chatMethodDefs, {
  "conversation.create": handleConversationCreate,
  "conversation.list": handleConversationList,
  "conversation.messages": handleConversationMessages,
  "conversation.tail": handleConversationTail,
  "conversation.patchTitle": handleConversationPatchTitle,
  "conversation.archive": handleConversationArchive,
  "conversation.unarchive": handleConversationUnarchive,
  "conversation.delete": handleConversationDelete,
  "conversation.rollbackBeforeLastUser": handleConversationRollbackBeforeLastUser,
  "conversation.subscribe": handleConversationSubscribe,
  "conversation.acpDock": handleConversationAcpDock,
  "conversation.commands": handleConversationCommands,
  "message.send": handleMessageSend,
  "message.interrupt": handleMessageInterrupt,
} as Record<keyof typeof chatMethodDefs, HubRouteHandler<z.ZodTypeAny, z.ZodTypeAny>>);
