import { z } from "zod";

export const capabilityMaskInputSchema = z.object({
  presets: z.array(z.string()).default([]),
});

export const conversationCreateInputSchema = z.object({
  title: z.string().optional(),
  platform: z.string().optional(),
  workspace_root: z.string().optional(),
  workspace_gitignore: z.boolean().optional(),
  workspace_show_hidden: z.boolean().optional(),
  capability_mask: capabilityMaskInputSchema.optional(),
});

export type ConversationCreateInput = z.infer<typeof conversationCreateInputSchema>;

export const conversationCreateOutputSchema = z.object({
  conversation_id: z.string(),
});

/** @deprecated 使用 conversationCreateOutputSchema */
export const sessionCreateOutputSchema = conversationCreateOutputSchema;

export type ConversationCreateOutput = z.infer<typeof conversationCreateOutputSchema>;

export const conversationListInputSchema = z.object({
  platform: z.string().optional(),
});

export type ConversationListInput = z.infer<typeof conversationListInputSchema>;

export const conversationSummarySchema = z.object({
  conversation_id: z.string(),
  title: z.string().optional(),
  platform: z.string().optional(),
  updated_at: z.string().optional(),
});

export type ConversationSummary = z.infer<typeof conversationSummarySchema>;

export const conversationListOutputSchema = z.object({
  conversations: z.array(conversationSummarySchema),
});

export type ConversationListOutput = z.infer<typeof conversationListOutputSchema>;

export const conversationMessagesInputSchema = z.object({
  conversation_id: z.string().min(1),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export type StoredMessagesInput = z.infer<typeof conversationMessagesInputSchema>;

export const conversationPatchTitleInputSchema = z.object({
  conversation_id: z.string().min(1),
  title: z.string().min(1),
});

export type ConversationPatchTitleInput = z.infer<typeof conversationPatchTitleInputSchema>;

export const conversationSubscribeInputSchema = z.object({
  conversation_id: z.string().min(1),
});

export type ConversationSubscribeInput = z.infer<typeof conversationSubscribeInputSchema>;

export const conversationUpdatedPayloadSchema = z.object({
  conversation_id: z.string(),
});

/** @deprecated 使用 conversationUpdatedPayloadSchema */
export const sessionUpdatedPayloadSchema = conversationUpdatedPayloadSchema;

export type ConversationUpdatedPayload = z.infer<typeof conversationUpdatedPayloadSchema>;

/** @deprecated 使用 ConversationUpdatedPayload */
export type SessionUpdatedPayload = ConversationUpdatedPayload;

export const conversationCommandsInputSchema = z.object({
  platform: z.string().optional(),
  all: z.boolean().optional(),
});

/** @deprecated 使用 conversationCommandsInputSchema */
export const sessionCommandsInputSchema = conversationCommandsInputSchema;

export type ConversationCommandsInput = z.infer<typeof conversationCommandsInputSchema>;

export const conversationCommandItemSchema = z.object({
  name: z.string(),
  description: z.string(),
  scope: z.string(),
  platforms: z.array(z.string()).nullable(),
});

/** @deprecated 使用 conversationCommandItemSchema */
export const sessionCommandItemSchema = conversationCommandItemSchema;

export type ConversationCommandItem = z.infer<typeof conversationCommandItemSchema>;

/** @deprecated 使用 ConversationCommandItem */
export type SessionCommandItem = ConversationCommandItem;

export const conversationCommandsOutputSchema = z.object({
  commands: z.array(conversationCommandItemSchema),
  platform: z.string().optional(),
});

/** @deprecated 使用 conversationCommandsOutputSchema */
export const sessionCommandsOutputSchema = conversationCommandsOutputSchema;

export type ConversationCommandsOutput = z.infer<typeof conversationCommandsOutputSchema>;
