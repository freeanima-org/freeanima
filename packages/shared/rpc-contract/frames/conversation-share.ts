import { z } from "zod";

export const conversationShareTtlSchema = z.enum(["1h", "1d", "1w", "1mo"]);

export type ConversationShareTtl = z.infer<typeof conversationShareTtlSchema>;

export const conversationShareCreateInputSchema = z.object({
  conversation_id: z.string().min(1),
  /** 默认 1h */
  ttl: conversationShareTtlSchema.optional(),
  /** 有则 selected；无则 full */
  pos_list: z.array(z.number().int()).min(1).optional(),
});

export type ConversationShareCreateInput = z.infer<typeof conversationShareCreateInputSchema>;

export const conversationShareCreateOutputSchema = z.object({
  id: z.string().min(1),
  expires_at: z.string().min(1),
  /** 相对壳 basepath 的路径，如 /share/<id> */
  url_path: z.string().min(1),
});

export type ConversationShareCreateOutput = z.infer<typeof conversationShareCreateOutputSchema>;

export const conversationShareGetInputSchema = z.object({
  id: z.string().min(1),
});

export type ConversationShareGetInput = z.infer<typeof conversationShareGetInputSchema>;

export const conversationShareGetOutputSchema = z.object({
  id: z.string().min(1),
  conversation_id: z.string().min(1),
  scope: z.enum(["full", "selected"]),
  title: z.string().optional(),
  display: z.array(z.record(z.string(), z.unknown())),
  created_at: z.string().min(1),
  expires_at: z.string().min(1),
});

export type ConversationShareGetOutput = z.infer<typeof conversationShareGetOutputSchema>;

export const conversationShareListInputSchema = z.object({});

export type ConversationShareListInput = z.infer<typeof conversationShareListInputSchema>;

export const conversationShareListItemSchema = z.object({
  id: z.string().min(1),
  conversation_id: z.string().min(1),
  scope: z.enum(["full", "selected"]),
  title: z.string().optional(),
  created_at: z.string().min(1),
  expires_at: z.string().min(1),
  message_count: z.number().int().min(0),
  ttl_remaining_seconds: z.number().int().nullable(),
  url_path: z.string().min(1),
});

export const conversationShareListOutputSchema = z.object({
  items: z.array(conversationShareListItemSchema),
});

export type ConversationShareListOutput = z.infer<typeof conversationShareListOutputSchema>;

export const conversationShareDeleteInputSchema = z.object({
  id: z.string().min(1),
});

export type ConversationShareDeleteInput = z.infer<typeof conversationShareDeleteInputSchema>;

export const conversationShareDeleteOutputSchema = z.object({
  ok: z.literal(true),
});

export type ConversationShareDeleteOutput = z.infer<typeof conversationShareDeleteOutputSchema>;
