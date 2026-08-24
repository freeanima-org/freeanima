import { z } from "zod";

export const roomMemberSchema = z.object({
  public_id: z.string().min(1),
  muted: z.boolean().optional(),
  /** 展示名（解析 Contact 后附带；存储可不写） */
  display_name: z.string().optional(),
  /** 是否本机 agent（可跑内心 Conversation） */
  is_local_agent: z.boolean().optional(),
});

export type RoomMemberPayload = z.infer<typeof roomMemberSchema>;

export const roomSummarySchema = z.object({
  room_id: z.string().min(1),
  title: z.string(),
  owner_public_id: z.string().min(1),
  members: z.array(roomMemberSchema),
  speaker_public_id: z.string().nullable().optional(),
  speaker_lease_until: z.string().nullable().optional(),
  updated_at: z.string(),
  created_at: z.string(),
  last_message_preview: z.string().optional(),
  federation_mode: z.enum(["local", "federated"]).optional(),
});

export type RoomSummaryPayload = z.infer<typeof roomSummarySchema>;

export const roomMessageSchema = z.object({
  id: z.string().min(1),
  room_id: z.string().min(1),
  seq: z.number().int().nonnegative(),
  speaker_public_id: z.string().min(1),
  speaker_display_name: z.string().optional(),
  text: z.string(),
  tool_summary: z.string().optional(),
  mention_public_ids: z.array(z.string()).optional(),
  created_at: z.string(),
});

export type RoomMessagePayload = z.infer<typeof roomMessageSchema>;

export const roomCreateInputSchema = z.object({
  title: z.string().min(1),
  /** 成员 public_id（须含创建者；本机 agent 会建内心席） */
  member_public_ids: z.array(z.string().min(1)).min(1),
  owner_public_id: z.string().min(1),
  /** Hub 上创建联邦 Room；Satellite 上创建时经联邦通道提交 Hub */
  federated: z.boolean().optional(),
});
export type RoomCreateInput = z.infer<typeof roomCreateInputSchema>;
export const roomCreateOutputSchema = z.object({ room: roomSummarySchema });
export type RoomCreateOutput = z.infer<typeof roomCreateOutputSchema>;

export const roomGetInputSchema = z.object({ room_id: z.string().min(1) });
export type RoomGetInput = z.infer<typeof roomGetInputSchema>;
export const roomGetOutputSchema = z.object({ room: roomSummarySchema });
export type RoomGetOutput = z.infer<typeof roomGetOutputSchema>;

export const roomListInputSchema = z.object({
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().max(200).optional(),
});
export type RoomListInput = z.infer<typeof roomListInputSchema>;
export const roomListOutputSchema = z.object({
  rooms: z.array(roomSummarySchema),
  total: z.number().int().nonnegative(),
});
export type RoomListOutput = z.infer<typeof roomListOutputSchema>;

export const roomDisbandInputSchema = z.object({
  room_id: z.string().min(1),
  actor_public_id: z.string().min(1),
});
export type RoomDisbandInput = z.infer<typeof roomDisbandInputSchema>;
export const roomDisbandOutputSchema = z.object({ ok: z.literal(true) });
export type RoomDisbandOutput = z.infer<typeof roomDisbandOutputSchema>;

export const roomMembersAddInputSchema = z.object({
  room_id: z.string().min(1),
  actor_public_id: z.string().min(1),
  member_public_ids: z.array(z.string().min(1)).min(1),
});
export type RoomMembersAddInput = z.infer<typeof roomMembersAddInputSchema>;
export const roomMembersAddOutputSchema = z.object({ room: roomSummarySchema });
export type RoomMembersAddOutput = z.infer<typeof roomMembersAddOutputSchema>;

export const roomMembersKickInputSchema = z.object({
  room_id: z.string().min(1),
  actor_public_id: z.string().min(1),
  member_public_id: z.string().min(1),
});
export type RoomMembersKickInput = z.infer<typeof roomMembersKickInputSchema>;
export const roomMembersKickOutputSchema = z.object({ room: roomSummarySchema });
export type RoomMembersKickOutput = z.infer<typeof roomMembersKickOutputSchema>;

export const roomLeaveInputSchema = z.object({
  room_id: z.string().min(1),
  actor_public_id: z.string().min(1),
});
export type RoomLeaveInput = z.infer<typeof roomLeaveInputSchema>;
export const roomLeaveOutputSchema = z.object({ ok: z.literal(true) });
export type RoomLeaveOutput = z.infer<typeof roomLeaveOutputSchema>;

export const roomMessagesListInputSchema = z.object({
  room_id: z.string().min(1),
  before_seq: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().max(200).optional(),
});
export type RoomMessagesListInput = z.infer<typeof roomMessagesListInputSchema>;
export const roomMessagesListOutputSchema = z.object({
  messages: z.array(roomMessageSchema),
});
export type RoomMessagesListOutput = z.infer<typeof roomMessagesListOutputSchema>;

export const roomMessageSendInputSchema = z.object({
  room_id: z.string().min(1),
  speaker_public_id: z.string().min(1),
  text: z.string().min(1),
  mention_public_ids: z.array(z.string().min(1)).optional(),
});
export type RoomMessageSendInput = z.infer<typeof roomMessageSendInputSchema>;
export const roomMessageSendOutputSchema = z.object({
  message: roomMessageSchema,
  /** 因 @ 触发的 agent 流式回合 */
  triggered_agent_turns: z
    .array(
      z.object({
        agent_public_id: z.string().min(1),
        conversation_id: z.string().min(1),
        stream_id: z.string().min(1),
      }),
    )
    .optional(),
});
export type RoomMessageSendOutput = z.infer<typeof roomMessageSendOutputSchema>;

export const roomSpeakerAcquireInputSchema = z.object({
  room_id: z.string().min(1),
  agent_public_id: z.string().min(1),
});
export type RoomSpeakerAcquireInput = z.infer<typeof roomSpeakerAcquireInputSchema>;
export const roomSpeakerAcquireOutputSchema = z.object({
  ok: z.boolean(),
  speaker_public_id: z.string().nullable(),
  speaker_lease_until: z.string().nullable().optional(),
  reason: z.string().optional(),
});
export type RoomSpeakerAcquireOutput = z.infer<typeof roomSpeakerAcquireOutputSchema>;

export const roomSpeakerHeartbeatInputSchema = z.object({
  room_id: z.string().min(1),
  agent_public_id: z.string().min(1),
});
export type RoomSpeakerHeartbeatInput = z.infer<typeof roomSpeakerHeartbeatInputSchema>;
export const roomSpeakerHeartbeatOutputSchema = z.object({
  ok: z.boolean(),
  speaker_lease_until: z.string().nullable().optional(),
});
export type RoomSpeakerHeartbeatOutput = z.infer<typeof roomSpeakerHeartbeatOutputSchema>;

export const roomSpeakerTurnCompleteInputSchema = z.object({
  room_id: z.string().min(1),
  agent_public_id: z.string().min(1),
});
export type RoomSpeakerTurnCompleteInput = z.infer<typeof roomSpeakerTurnCompleteInputSchema>;
export const roomSpeakerTurnCompleteOutputSchema = z.object({ ok: z.literal(true) });
export type RoomSpeakerTurnCompleteOutput = z.infer<typeof roomSpeakerTurnCompleteOutputSchema>;

export const roomSpeakerInterruptInputSchema = z.object({
  room_id: z.string().min(1),
  actor_public_id: z.string().min(1),
});
export type RoomSpeakerInterruptInput = z.infer<typeof roomSpeakerInterruptInputSchema>;
export const roomSpeakerInterruptOutputSchema = z.object({ ok: z.literal(true) });
export type RoomSpeakerInterruptOutput = z.infer<typeof roomSpeakerInterruptOutputSchema>;

export const roomAgentTurnInputSchema = z.object({
  room_id: z.string().min(1),
  agent_public_id: z.string().min(1),
});
export type RoomAgentTurnInput = z.infer<typeof roomAgentTurnInputSchema>;
export const roomAgentTurnOutputSchema = z.object({
  ok: z.boolean(),
  conversation_id: z.string().optional(),
  stream_id: z.string().optional(),
  reason: z.string().optional(),
});
export type RoomAgentTurnOutput = z.infer<typeof roomAgentTurnOutputSchema>;

/** 确保本机 agent 在房间的内心 Conversation（slash 等） */
export const roomAgentConversationInputSchema = z.object({
  room_id: z.string().min(1),
  agent_public_id: z.string().min(1),
});
export type RoomAgentConversationInput = z.infer<typeof roomAgentConversationInputSchema>;
export const roomAgentConversationOutputSchema = z.object({
  ok: z.boolean(),
  conversation_id: z.string().optional(),
  reason: z.string().optional(),
});
export type RoomAgentConversationOutput = z.infer<typeof roomAgentConversationOutputSchema>;

export const ROOM_MESSAGE_CREATED_EVENT = "room.message.created" as const;
export const ROOM_SPEAKER_CHANGED_EVENT = "room.speaker.changed" as const;
