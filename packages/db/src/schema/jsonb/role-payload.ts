import { messageUsageSchema, toolCallSchema } from "@freeanima/kernel";
import { z } from "zod";

/** messages 表可存的 role（不含 system） */
export const MESSAGE_ROLES = ["user", "assistant", "tool"] as const;

export type MessageRole = (typeof MESSAGE_ROLES)[number];

export const messageRoleSchema = z.enum(MESSAGE_ROLES);

export function isMessageRole(value: string): value is MessageRole {
  return (MESSAGE_ROLES as readonly string[]).includes(value);
}

const userRolePayloadSchema = z.object({
  role: z.literal("user"),
  name: z.string().optional(),
});

const assistantRolePayloadSchema = z.object({
  role: z.literal("assistant"),
  name: z.string().optional(),
  tool_calls: z.array(toolCallSchema).optional(),
  model: z.string().optional(),
  finish_reason: z.string().optional(),
  reasoning: z.string().optional(),
  reasoning_content: z.string().optional(),
  usage: messageUsageSchema.optional(),
  latency_ms: z.number().optional(),
});

const toolRolePayloadSchema = z.object({
  role: z.literal("tool"),
  tool_call_id: z.string(),
  name: z.string().optional(),
});

/** role + 角色差异字段（content / ts / id 在 messages 列） */
export const rolePayloadSchema = z.discriminatedUnion("role", [
  userRolePayloadSchema,
  assistantRolePayloadSchema,
  toolRolePayloadSchema,
]);

export type RolePayload = z.infer<typeof rolePayloadSchema>;
export type UserRolePayload = z.infer<typeof userRolePayloadSchema>;
export type AssistantRolePayload = z.infer<typeof assistantRolePayloadSchema>;
export type ToolRolePayload = z.infer<typeof toolRolePayloadSchema>;
