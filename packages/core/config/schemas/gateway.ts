import { z } from "zod";

/** 与 gateway tool-display 模式对齐（core 不依赖 platform） */
export const gatewayToolDisplaySchema = z.enum([
  "hidden",
  "count",
  "name",
  "name_args_truncated",
  "name_args_full",
  "name_args_result_full",
]);

export const gatewayConfigSchema = z
  .object({
    tool_display: gatewayToolDisplaySchema.optional(),
  })
  .passthrough()
  .optional();

export type GatewayConfigInput = z.infer<typeof gatewayConfigSchema>;
