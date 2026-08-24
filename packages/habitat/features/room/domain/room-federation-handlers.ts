import { z } from "zod";
import {
  roomFederationAppendRequestSchema,
  roomFederationAppendResultSchema,
  roomFederationBroadcastPayloadSchema,
  roomFederationCatchUpRequestSchema,
  roomFederationCatchUpResultSchema,
  roomFederationCreatedPayloadSchema,
  roomFederationSnapshotRequestSchema,
  roomFederationSnapshotResultSchema,
} from "@freeanima/shared/rpc-contract/frames/room-federation.ts";
import { getRoom } from "@freeanima/habitat/core/db/pg/room";

import {
  applyFederatedMessageReplica,
  applyFederatedRoomReplica,
  catchUpMessagesFromHubDb,
  membersFromSummary,
} from "./room-federation.ts";
import {
  createFederatedRoomOnHub,
  getRoomSummary,
  listMessages,
  sendFederatedMessageOnHub,
  type RoomDomainDeps,
} from "./room-service.ts";

const roomCreateOverFederationSchema = z.object({
  title: z.string().min(1),
  owner_public_id: z.string().min(1),
  member_public_ids: z.array(z.string().min(1)).min(1),
});

/** Hub：Satellite 提交 append */
export async function hubHandleRoomAppend(payload: unknown): Promise<unknown> {
  const parsed = roomFederationAppendRequestSchema.parse(payload);
  const message = await sendFederatedMessageOnHub({
    room_id: parsed.room_id,
    speaker_public_id: parsed.speaker_public_id,
    text: parsed.text,
    ...(parsed.mention_public_ids ? { mention_public_ids: parsed.mention_public_ids } : {}),
  });
  return roomFederationAppendResultSchema.parse({ message });
}

/** Hub：catch_up */
export async function hubHandleRoomCatchUp(payload: unknown): Promise<unknown> {
  const parsed = roomFederationCatchUpRequestSchema.parse(payload);
  const messages = await catchUpMessagesFromHubDb(parsed.room_id, parsed.from_seq);
  return roomFederationCatchUpResultSchema.parse({
    room_id: parsed.room_id,
    messages,
  });
}

/** Hub：snapshot */
export async function hubHandleRoomSnapshot(payload: unknown): Promise<unknown> {
  const parsed = roomFederationSnapshotRequestSchema.parse(payload);
  const summary = await getRoomSummary(parsed.room_id);
  if (!summary) throw new Error("ROOM_NOT_FOUND");
  const messages = await listMessages(parsed.room_id, { limit: 200 });
  return roomFederationSnapshotResultSchema.parse({
    room: { ...summary, federation_mode: "federated" as const },
    messages,
  });
}

/** Hub：Satellite 请求创建联邦 Room */
export async function hubHandleRoomCreate(
  deps: RoomDomainDeps,
  payload: unknown,
): Promise<unknown> {
  const input = roomCreateOverFederationSchema.parse(payload);
  const summary = await createFederatedRoomOnHub(deps, input);
  return roomFederationCreatedPayloadSchema.parse({
    room: { ...summary, federation_mode: "federated" },
  });
}

/** Satellite：应用 Hub 推送 */
export async function satelliteHandleFederationFrame(
  method: string,
  payload: unknown,
): Promise<void> {
  if (method === "room.federation.broadcast") {
    const parsed = roomFederationBroadcastPayloadSchema.parse(payload);
    await applyFederatedMessageReplica({ message: parsed.message });
    return;
  }
  if (method === "room.federation.created") {
    const parsed = roomFederationCreatedPayloadSchema.parse(payload);
    await applyFederatedRoomReplica({
      room_id: parsed.room.room_id,
      title: parsed.room.title,
      owner_public_id: parsed.room.owner_public_id,
      members: membersFromSummary(parsed.room),
    });
    return;
  }
  if (method === "room.federation.catch_up.result") {
    const parsed = roomFederationCatchUpResultSchema.parse(payload);
    for (const message of parsed.messages) {
      await applyFederatedMessageReplica({ message });
    }
  }
}

export async function assertFederatedRoomExists(roomId: string): Promise<void> {
  const room = await getRoom(roomId);
  if (!room) throw new Error("ROOM_NOT_FOUND");
  if (room.federation_mode !== "federated") throw new Error("ROOM_NOT_FEDERATED");
}
