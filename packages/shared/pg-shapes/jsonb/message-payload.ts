import { z } from "zod";

export const openAiFunctionSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
});

export const openAiToolSchema = z.object({
  type: z.literal("function"),
  function: openAiFunctionSchema,
});

export const toolCallSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  function: z.object({
    name: z.string(),
    arguments: z.string().default("{}"),
  }),
});

export const messageUsageSchema = z.record(z.string(), z.number());

const messageBaseSchema = z.object({
  timestamp: z.string().optional(),
});

/** 用户消息附件元数据（字节在 Habitat 临时目录，不进 JSONB） */
export const messageAttachmentMetaSchema = z.object({
  filename: z.string().min(1),
  mime_type: z.string().min(1),
  size: z.number().int().nonnegative(),
});

export type MessageAttachmentMeta = z.infer<typeof messageAttachmentMetaSchema>;

/**
 * 仅 runtime 喂 vision：勿持久化进 PG（appendMessage 会剥掉）。
 * OpenAI/Anthropic adapter 读此字段展开为 image parts。
 */
export const messageContentMediaSchema = z.object({
  type: z.literal("image"),
  mime_type: z.string().min(1),
  data_base64: z.string().min(1),
});

export type MessageContentMedia = z.infer<typeof messageContentMediaSchema>;

export const userPayloadSchema = messageBaseSchema.extend({
  role: z.literal("user"),
  content: z.string(),
  name: z.string().optional(),
  /** 客户端 outbox 幂等键（Habitat 写 RPC / Stream outbox 约定 client_op_id） */
  client_op_id: z.string().optional(),
  attachments: z.array(messageAttachmentMetaSchema).optional(),
  content_media: z.array(messageContentMediaSchema).optional(),
});

export const systemPayloadSchema = messageBaseSchema.extend({
  role: z.literal("system"),
  content: z.string(),
  name: z.string().optional(),
});

export const assistantPayloadSchema = messageBaseSchema.extend({
  role: z.literal("assistant"),
  content: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => v ?? null),
  tool_calls: z.array(toolCallSchema).optional(),
  model: z.string().optional(),
  finish_reason: z.string().optional(),
  reasoning: z.string().optional(),
  usage: messageUsageSchema.optional(),
  latency_ms: z.number().optional(),
  name: z.string().optional(),
});

export const toolPayloadSchema = messageBaseSchema.extend({
  role: z.literal("tool"),
  tool_call_id: z.string(),
  content: z.string(),
  name: z.string().optional(),
});

/** messages.payload JSONB — excludes pos (pos maintained by column) */
export const messagePayloadSchema = z.discriminatedUnion("role", [
  userPayloadSchema,
  systemPayloadSchema,
  assistantPayloadSchema,
  toolPayloadSchema,
]);

export type MessagePayload = z.infer<typeof messagePayloadSchema>;
export type ConversationPayload = MessagePayload;

export type OpenAiToolSchema = z.infer<typeof openAiToolSchema>;
export type ToolCall = z.infer<typeof toolCallSchema>;

export type LlmTurnMessage =
  | Extract<MessagePayload, { role: "user" }>
  | Extract<MessagePayload, { role: "assistant" }>
  | Extract<MessagePayload, { role: "tool" }>
  | Extract<MessagePayload, { role: "system" }>;
