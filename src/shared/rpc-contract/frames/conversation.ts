import { z } from "zod";

export const conversationCreateInputSchema = z.object({
  title: z.string().optional(),
  platform: z.string().optional(),
  /** Prompt 模式：chat=数字人类；coding=工作；缺省由服务端按 platform 推断 */
  module: z.enum(["chat", "coding"]).optional(),
  workspace_root: z.string().optional(),
  workspace_gitignore: z.boolean().optional(),
  workspace_show_hidden: z.boolean().optional(),
  project_world_id: z.number().int().positive().optional(),
});

export type ConversationCreateInput = z.infer<typeof conversationCreateInputSchema>;

export const conversationCreateOutputSchema = z.object({
  conversation_id: z.string(),
});

export type ConversationCreateOutput = z.infer<typeof conversationCreateOutputSchema>;

export const conversationListInputSchema = z.object({
  platform: z.string().optional(),
  include_archived: z.boolean().optional(),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export type ConversationListInput = z.infer<typeof conversationListInputSchema>;

export const conversationSummarySchema = z.object({
  conversation_id: z.string(),
  title: z.string().optional(),
  platform: z.string().optional(),
  updated_at: z.string().optional(),
  archived_at: z.string().nullable().optional(),
  /** 用户未读：存在尚未读到的 assistant 回复 */
  unread: z.boolean().optional(),
});

export type ConversationSummary = z.infer<typeof conversationSummarySchema>;

export const conversationListOutputSchema = z.object({
  conversations: z.array(conversationSummarySchema),
});

export type ConversationListOutput = z.infer<typeof conversationListOutputSchema>;

export const conversationMarkReadInputSchema = z.object({
  conversation_id: z.string().min(1),
  last_read_pos: z.number().int().min(0).optional(),
});

export type ConversationMarkReadInput = z.infer<typeof conversationMarkReadInputSchema>;

export const conversationMarkReadOutputSchema = z.object({
  ok: z.literal(true),
  last_read_pos: z.number().int().min(0),
});

export type ConversationMarkReadOutput = z.infer<typeof conversationMarkReadOutputSchema>;

export const conversationUnreadCountInputSchema = z.object({});

export type ConversationUnreadCountInput = z.infer<typeof conversationUnreadCountInputSchema>;

export const conversationUnreadCountOutputSchema = z.object({
  count: z.number().int().min(0),
});

export type ConversationUnreadCountOutput = z.infer<typeof conversationUnreadCountOutputSchema>;

export const conversationSubscribeInboxInputSchema = z.object({});

export type ConversationSubscribeInboxInput = z.infer<typeof conversationSubscribeInboxInputSchema>;

export const conversationMessagesInputSchema = z.object({
  conversation_id: z.string().min(1),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(500).optional(),
  /** Chat 向上加载：取 pos < before_pos 的最近 limit 条；与 offset 互斥（Chat 不传 offset） */
  before_pos: z.number().int().min(0).optional(),
});

export const conversationTailInputSchema = z.object({
  conversation_id: z.string().min(1),
});

export type ConversationTailInput = z.infer<typeof conversationTailInputSchema>;

export const conversationTailOutputSchema = z.object({
  tail_pos: z.number().int().min(0),
  tail_role: z.string().optional(),
  updated_at: z.string().optional(),
});

export type ConversationTailOutput = z.infer<typeof conversationTailOutputSchema>;

export type StoredMessagesInput = z.infer<typeof conversationMessagesInputSchema>;

export const conversationPatchTitleInputSchema = z.object({
  conversation_id: z.string().min(1),
  title: z.string().min(1),
});

export type ConversationPatchTitleInput = z.infer<typeof conversationPatchTitleInputSchema>;

export const conversationArchiveInputSchema = z.object({
  conversation_id: z.string().min(1),
});

export type ConversationArchiveInput = z.infer<typeof conversationArchiveInputSchema>;

export const conversationUnarchiveInputSchema = z.object({
  conversation_id: z.string().min(1),
});

export type ConversationUnarchiveInput = z.infer<typeof conversationUnarchiveInputSchema>;

export const conversationDeleteInputSchema = z.object({
  conversation_id: z.string().min(1),
});

export type ConversationDeleteInput = z.infer<typeof conversationDeleteInputSchema>;

export const conversationMutateOutputSchema = z.object({
  ok: z.literal(true),
});

export type ConversationMutateOutput = z.infer<typeof conversationMutateOutputSchema>;

export const conversationSubscribeInputSchema = z.object({
  conversation_id: z.string().min(1),
});

export type ConversationSubscribeInput = z.infer<typeof conversationSubscribeInputSchema>;

export const conversationUpdatedPayloadSchema = z.object({
  conversation_id: z.string(),
});

export type ConversationUpdatedPayload = z.infer<typeof conversationUpdatedPayloadSchema>;

export const conversationCommandsInputSchema = z.object({
  platform: z.string().optional(),
  all: z.boolean().optional(),
});

export type ConversationCommandsInput = z.infer<typeof conversationCommandsInputSchema>;

export const conversationCommandItemSchema = z.object({
  name: z.string(),
  description: z.string(),
  scope: z.string(),
  platforms: z.array(z.string()).nullable(),
  subcommands: z.array(z.object({ name: z.string(), description: z.string() })).optional(),
});

export type ConversationCommandItem = z.infer<typeof conversationCommandItemSchema>;

export const conversationCommandsOutputSchema = z.object({
  commands: z.array(conversationCommandItemSchema),
  platform: z.string().optional(),
});

export type ConversationCommandsOutput = z.infer<typeof conversationCommandsOutputSchema>;

export const conversationCommandInputSchema = z.object({
  conversation_id: z.string().min(1),
  text: z.string().min(1),
});

export type ConversationCommandInput = z.infer<typeof conversationCommandInputSchema>;

export const conversationCommandOutputSchema = z.discriminatedUnion("delivery", [
  z.object({
    delivery: z.literal("message"),
  }),
  z.object({
    delivery: z.literal("rpc"),
    ux: z.enum(["panel", "toast", "none"]),
    text: z.string(),
    command: z.string(),
  }),
]);

export type ConversationCommandOutput = z.infer<typeof conversationCommandOutputSchema>;
