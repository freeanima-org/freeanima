import { z } from "zod";

export const capabilityMaskPresetSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  allowed_tools_summary: z.array(z.string()).optional(),
});

/** @deprecated SAP/1.0 connect 已移除；仅测试/文档引用 */
export const SAP_LEGACY_VERSION = "SAP/1.0";

export const heartbeatPayloadSchema = z.object({
  ts: z.number().optional(),
});

export type HeartbeatPayload = z.infer<typeof heartbeatPayloadSchema>;
