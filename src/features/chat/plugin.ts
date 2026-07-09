import {
  handleConversationAcpDock,
  handleConversationArchive,
  handleConversationCommands,
  handleConversationCreate,
  handleConversationDelete,
  handleConversationList,
  handleConversationMessages,
  handleConversationTail,
  handleConversationPatchTitle,
  handleConversationRollbackBeforeLastUser,
  handleConversationSubscribe,
  handleConversationUnarchive,
  handleMessageInterrupt,
  handleMessageSend,
} from "./hub/rpc.ts";

/** Chat feature plugin — shell + conversation/message Hub RPC. */
export const chatPlugin = {
  id: "chat",
  shell: {
    routes: [{ path: "/chat", featureId: "chat", navLabel: "Chat" }],
  },
  hub: {
    rpc: {
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
    },
  },
} as const;
