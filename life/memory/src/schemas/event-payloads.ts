import { z } from "zod";

export const sessionUpdatedPayloadSchema = z.object({ session_id: z.string() }).passthrough();

export const semanticMemoryUpdatedPayloadSchema = z
  .object({ semantic_memory_ids: z.array(z.string()).optional() })
  .passthrough();

export const testPingPayloadSchema = z.record(z.string(), z.unknown());

export const eventPayloadSchemas = {
  "session:updated": sessionUpdatedPayloadSchema,
  "semantic_memory:updated": semanticMemoryUpdatedPayloadSchema,
  "test:ping": testPingPayloadSchema,
} as const;

/** EventBus topic → payload type map */
export type EventMap = {
  [K in keyof typeof eventPayloadSchemas]: z.infer<(typeof eventPayloadSchemas)[K]>;
};

export type EventTopic = keyof EventMap;
