import type { ConversationService } from "@freeanima/engine/conversation";

export type RuntimeDeps = {
  conversation: ConversationService;
  interruptSessionStream?: (conversationId: string) => void;
};
