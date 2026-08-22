import type { ConversationService } from "@freeanima/habitat/engine/conversation";

export type RuntimeDeps = {
  conversation: ConversationService;
  interruptSessionStream?: (conversationId: string) => void;
};
