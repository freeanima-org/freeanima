import { createHook } from "@freeanima/kernel/hooks";

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
  "@freeanima/runtime/conversation-hooks/message-incoming",
  "Inbound message intercept",
);

export const turnAfterComplete = createHook<TurnAfterCompleteContext, TurnAfterCompleteEffect>(
  "@freeanima/runtime/conversation-hooks/turn-after-complete",
  "After single turn ends",
);
