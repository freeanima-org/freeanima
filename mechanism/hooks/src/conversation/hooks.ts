import { createHook } from "@freeanima/kernel-hooks";

export type MessageIncomingContext = {
  sessionId: string;
  message: string;
  platform: string;
};

export type MessageIncomingEffect = {
  transformedMessage?: string;
  expiredHint?: string;
};

export type TurnAfterCompleteContext = {
  sessionId: string;
  messages: Record<string, unknown>[];
};

export type TurnAfterCompleteEffect = {
  displayContent?: string;
};

export const messageIncoming = createHook<MessageIncomingContext, MessageIncomingEffect>(
  "@freeanima/orchestration-conversation-hooks/message-incoming",
  "Inbound message intercept",
);

export const turnAfterComplete = createHook<TurnAfterCompleteContext, TurnAfterCompleteEffect>(
  "@freeanima/orchestration-conversation-hooks/turn-after-complete",
  "After single turn ends",
);
