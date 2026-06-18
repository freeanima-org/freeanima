import { z } from "zod";

const jsonSchemaObjectSchema = z.record(z.string(), z.unknown());

export const sapToolDefInputSchema = z.object({
  local_name: z.string().min(1),
  description: z.string(),
  parameters: jsonSchemaObjectSchema,
  return_kind: z.enum(["json", "text"]).default("json"),
});

export type SapToolDefInput = z.infer<typeof sapToolDefInputSchema>;

export const toolRegisterInputSchema = z.object({
  tools: z.array(sapToolDefInputSchema).min(1),
  /** SAP satellite toolsets default to private (mask-only discovery) */
  private: z.boolean().default(true),
});

export type ToolRegisterInput = z.infer<typeof toolRegisterInputSchema>;

export const toolRegisterOutputSchema = z.object({
  registered: z.array(z.string()),
});

export type ToolRegisterOutput = z.infer<typeof toolRegisterOutputSchema>;

export const toolUnregisterInputSchema = z.object({
  local_names: z.array(z.string()).optional(),
});

export type ToolUnregisterInput = z.infer<typeof toolUnregisterInputSchema>;

export const toolCallPayloadSchema = z.object({
  call_id: z.string().min(1),
  tool_name: z.string().min(1),
  local_name: z.string().min(1),
  args: z.record(z.string(), z.unknown()),
  session_id: z.string().min(1),
  workspace_root: z.string().optional(),
});

export type ToolCallPayload = z.infer<typeof toolCallPayloadSchema>;

export const toolResultInputSchema = z.object({
  call_id: z.string().min(1),
  content: z.string(),
});

export type ToolResultInput = z.infer<typeof toolResultInputSchema>;

export const toolErrorInputSchema = z.object({
  call_id: z.string().min(1),
  error: z.string().min(1),
});

export type ToolErrorInput = z.infer<typeof toolErrorInputSchema>;
