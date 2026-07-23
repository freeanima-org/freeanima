import { z } from "zod";

export const capabilityMaskPresetSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  allowed_tools_summary: z.array(z.string()).optional(),
});

export const heartbeatPayloadSchema = z.object({
  ts: z.number().optional(),
});

export type HeartbeatPayload = z.infer<typeof heartbeatPayloadSchema>;
