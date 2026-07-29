import { z } from "zod";

export const conversationUpdatedPayloadSchema = z
  .object({ conversation_id: z.string() })
  .passthrough();

export const semanticMemoryUpdatedPayloadSchema = z
  .object({ semantic_memory_ids: z.array(z.number().int().positive()).optional() })
  .passthrough();

export const testPingPayloadSchema = z.record(z.string(), z.unknown());

export const eventPayloadSchemas = {
  "conversation:updated": conversationUpdatedPayloadSchema,
  "semantic_memory:updated": semanticMemoryUpdatedPayloadSchema,
  "test:ping": testPingPayloadSchema,
} as const;

/** Hook notify topic → payload type map（subscribe / emit） */
export type EventMap = {
  [K in keyof typeof eventPayloadSchemas]: z.infer<(typeof eventPayloadSchemas)[K]>;
};

export type EventTopic = keyof EventMap;
