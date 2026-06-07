import { z } from "zod";

export const sessionUpdatedPayloadSchema = z.object({ session_id: z.string() }).passthrough();

export const l2UpdatedPayloadSchema = z.object({ session_id: z.string() }).passthrough();

export const l3UpdatedPayloadSchema = z
  .object({ semantic_memory_ids: z.array(z.string()).optional() })
  .passthrough();

export const testPingPayloadSchema = z.record(z.string(), z.unknown());

export const eventPayloadSchemas = {
  "session:updated": sessionUpdatedPayloadSchema,
  "l2:updated": l2UpdatedPayloadSchema,
  "l3:updated": l3UpdatedPayloadSchema,
  "test:ping": testPingPayloadSchema,
} as const;

/** EventBus topic → payload 类型图 */
export type EventMap = {
  [K in keyof typeof eventPayloadSchemas]: z.infer<(typeof eventPayloadSchemas)[K]>;
};

export type EventTopic = keyof EventMap;
