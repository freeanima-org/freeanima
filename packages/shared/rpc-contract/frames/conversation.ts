import { z } from "zod";

export const conversationCreateInputSchema = z.object({
  title: z.string().optional(),
  platform: z.string().optional(),
  /** 情景行为档：digital_human | coding_agent | room_inner；缺省由服务端推断 */
  scenario: z.enum(["digital_human", "coding_agent", "room_inner"]).optional(),
  workspace_root: z.string().optional(),
  workspace_gitignore: z.boolean().optional(),
  workspace_show_hidden: z.boolean().optional(),
  project_world_id: z.number().int().positive().optional(),
  /** Coding / Companion outpost：写入 platform_extra */
  outpost_app_id: z.string().optional(),
  outpost_instance_id: z.string().optional(),
  /** 绑定的 Anima（type=agent）；缺省 = chat.default_agent_subject_id */
  agent_subject_id: z.number().int().positive().optional(),
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
  /** 按情景筛选；缺省不过滤 */
  scenario: z.enum(["digital_human", "coding_agent", "room_inner"]).optional(),
});

export type ConversationListInput = z.infer<typeof conversationListInputSchema>;

export const conversationSummarySchema = z.object({
  conversation_id: z.string(),
  title: z.string().optional(),
  platform: z.string().optional(),
  updated_at: z.string().optional(),
  archived_at: z.string().nullable().optional(),
  /** 置顶时间；非空表示已置顶 */
  pinned_at: z.string().nullable().optional(),
  /** 用户未读：存在尚未读到的 assistant 回复 */
  unread: z.boolean().optional(),
  /** 绑定的 Anima subject id */
  agent_subject_id: z.number().int().positive().optional(),
  /** 展示用；列表可附带 */
  agent_title: z.string().optional(),
  /** 情景行为档；缺省视为 digital_human */
  scenario: z.enum(["digital_human", "coding_agent", "room_inner"]).optional(),
  /** 群聊内心席绑定的 room_id */
  room_id: z.string().min(1).optional(),
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

export const conversationUnreadCountInputSchema = z.object({
  /** 与 conversation.list 对齐；Chat Shell 传 chat */
  platform: z.string().optional(),
});

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

export const conversationPinInputSchema = z.object({
  conversation_id: z.string().min(1),
});

export type ConversationPinInput = z.infer<typeof conversationPinInputSchema>;

export const conversationUnpinInputSchema = z.object({
  conversation_id: z.string().min(1),
});

export type ConversationUnpinInput = z.infer<typeof conversationUnpinInputSchema>;

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

/** 空会话（尚无用户消息）时可改绑 agent */
export const conversationSetAgentInputSchema = z.object({
  conversation_id: z.string().min(1),
  agent_subject_id: z.number().int().positive(),
});

export type ConversationSetAgentInput = z.infer<typeof conversationSetAgentInputSchema>;

export const conversationSetAgentOutputSchema = z.object({
  ok: z.literal(true),
  agent_subject_id: z.number().int().positive(),
});

export type ConversationSetAgentOutput = z.infer<typeof conversationSetAgentOutputSchema>;
