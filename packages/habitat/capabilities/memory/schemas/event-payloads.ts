import { z } from "zod";

export const conversationUpdatedPayloadSchema = z
  .object({ conversation_id: z.string() })
  .passthrough();

export const eventPayloadSchemas = {
  "conversation:updated": conversationUpdatedPayloadSchema,
} as const;

/** Hook notify topic → payload type map（subscribe / emit） */
export type EventMap = {
  [K in keyof typeof eventPayloadSchemas]: z.infer<(typeof eventPayloadSchemas)[K]>;
};

export type EventTopic = keyof EventMap;
