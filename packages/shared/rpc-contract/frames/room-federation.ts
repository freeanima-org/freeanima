import { z } from "zod";

import { roomMemberSchema, roomMessageSchema, roomSummarySchema } from "./room.ts";

export const roomFederationModeSchema = z.enum(["local", "federated"]);

export const roomFederationCreatedPayloadSchema = z.object({
  room: roomSummarySchema.extend({
    federation_mode: roomFederationModeSchema,
  }),
});

export const roomFederationAppendRequestSchema = z.object({
  room_id: z.string().min(1),
  speaker_public_id: z.string().min(1),
  text: z.string().min(1),
  mention_public_ids: z.array(z.string().min(1)).optional(),
  client_op_id: z.string().min(1).optional(),
});

export const roomFederationAppendResultSchema = z.object({
  message: roomMessageSchema,
});

export const roomFederationBroadcastPayloadSchema = z.object({
  message: roomMessageSchema,
});

export const roomFederationCatchUpRequestSchema = z.object({
  room_id: z.string().min(1),
  from_seq: z.number().int().nonnegative(),
});

export const roomFederationCatchUpResultSchema = z.object({
  room_id: z.string().min(1),
  messages: z.array(roomMessageSchema),
});

export const roomFederationSnapshotRequestSchema = z.object({
  room_id: z.string().min(1),
});

export const roomFederationSnapshotResultSchema = z.object({
  room: roomSummarySchema.extend({
    federation_mode: roomFederationModeSchema,
  }),
  messages: z.array(roomMessageSchema),
  members: z.array(roomMemberSchema).optional(),
});

export const roomSyncStatusSchema = z.object({
  room_id: z.string().min(1),
  federation_mode: roomFederationModeSchema,
  /** Hub 可达 / Satellite 已连接 / 落后条数 */
  hub_reachable: z.boolean(),
  last_synced_seq: z.number().int().nonnegative().nullable(),
  latest_seq: z.number().int().nonnegative().nullable(),
  behind_count: z.number().int().nonnegative().nullable(),
  status: z.enum(["local", "synced", "behind", "hub_unavailable"]),
});

export type RoomSyncStatusPayload = z.infer<typeof roomSyncStatusSchema>;

export const roomSyncStatusInputSchema = z.object({
  room_id: z.string().min(1),
});
export type RoomSyncStatusInput = z.infer<typeof roomSyncStatusInputSchema>;

export const roomSyncStatusOutputSchema = z.object({
  sync: roomSyncStatusSchema,
});
export type RoomSyncStatusOutput = z.infer<typeof roomSyncStatusOutputSchema>;
