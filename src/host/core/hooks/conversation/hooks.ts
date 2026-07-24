import { createHook } from "@freeanima/host/kernel/hooks";

export type MessageIncomingContext = {
  conversationId: string;
  message: string;
  platform: string;
};

export type MessageIncomingEffect = {
  transformedMessage?: string;
  expiredHint?: string;
};

export type TurnAfterCompleteContext = {
  conversationId: string;
  messages: Record<string, unknown>[];
};

export type TurnAfterCompleteEffect = {
  displayContent?: string;
};

export const messageIncoming = createHook<MessageIncomingContext, MessageIncomingEffect>(
  "@freeanima/host/engine/conversation-hooks/message-incoming",
  "Inbound message intercept",
);

export const turnAfterComplete = createHook<TurnAfterCompleteContext, TurnAfterCompleteEffect>(
  "@freeanima/host/engine/conversation-hooks/turn-after-complete",
  "After single turn ends",
);
