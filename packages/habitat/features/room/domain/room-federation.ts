import { randomPublicId } from "@freeanima/shared/util";
import { HABITAT_INSTANCE_ID_PREFIX } from "@freeanima/shared/identity";
import type {
  RoomMessagePayload,
  RoomSummaryPayload,
} from "@freeanima/shared/rpc-contract/frames/room.ts";
import type { RoomSyncStatusPayload } from "@freeanima/shared/rpc-contract/frames/room-federation.ts";
import {
  encodeFederationFrame,
  getFederationManager,
  resolveFederationRole,
} from "@freeanima/habitat/capabilities/federation";
import {
  getRoom,
  getRoomFederationState,
  listRoomMessagesAfterSeq,
  maxRoomSeq,
  setRoomFederationState,
  upsertRoomMessageBySeq,
  upsertRoomReplica,
} from "@freeanima/habitat/core/db/pg/room";
import type { RoomMembersJson, RoomPublicPayload } from "@freeanima/habitat/core/db/schema";
import { habitatCtx } from "@freeanima/features/habitat/habitat/habitat-api/handlers/runtime.ts";

/** 联邦 Room 全局 ID：room-{hub_fa_inst}-{nanoid} */
export function formatFederatedRoomId(hubInstanceId: string, localId = randomPublicId()): string {
  if (!hubInstanceId.startsWith(HABITAT_INSTANCE_ID_PREFIX)) {
    throw new Error("invalid hub habitat_instance_id");
  }
  return `room-${hubInstanceId}-${localId}`;
}

export function parseFederatedRoomId(
  roomId: string,
): { hub_instance_id: string; local_id: string } | null {
  const prefix = "room-";
  if (!roomId.startsWith(prefix)) return null;
  const rest = roomId.slice(prefix.length);
  const hubPrefix = HABITAT_INSTANCE_ID_PREFIX;
  if (!rest.startsWith(hubPrefix)) return null;
  const afterHub = rest.slice(hubPrefix.length);
  const dash = afterHub.indexOf("-");
  if (dash <= 0) return null;
  const hubNanoid = afterHub.slice(0, dash);
  const local_id = afterHub.slice(dash + 1);
  if (!local_id) return null;
  return { hub_instance_id: `${hubPrefix}${hubNanoid}`, local_id };
}

export function isFederatedRoomId(roomId: string): boolean {
  return parseFederatedRoomId(roomId) != null;
}

export function broadcastFederationFrame(method: string, payload: unknown, except?: string): void {
  const mgr = getFederationManager();
  if (!mgr) return;
  mgr.hubRegistry.broadcast(encodeFederationFrame(method, payload), except);
}

export function federationRoleNow(): "disabled" | "hub" | "satellite" {
  try {
    return resolveFederationRole(habitatCtx().engine.config.data.federation);
  } catch {
    return "disabled";
  }
}

export function hubInstanceIdNow(): string | null {
  try {
    return habitatCtx().engine.config.data.identity?.habitat_instance_id ?? null;
  } catch {
    return null;
  }
}

export function isHubReachableForSatellite(): boolean {
  const mgr = getFederationManager();
  const client = mgr?.satelliteClient;
  return client?.getState() === "connected" && client.isHubTrusted();
}

export async function applyFederatedMessageReplica(input: {
  message: RoomMessagePayload;
}): Promise<boolean> {
  const msg = input.message;
  const { inserted } = await upsertRoomMessageBySeq({
    id: msg.id,
    room_id: msg.room_id,
    seq: msg.seq,
    speaker_public_id: msg.speaker_public_id,
    payload: {
      text: msg.text,
      ...(msg.tool_summary ? { tool_summary: msg.tool_summary } : {}),
      ...(msg.mention_public_ids ? { mention_public_ids: msg.mention_public_ids } : {}),
    } satisfies RoomPublicPayload,
    created_at: new Date(msg.created_at),
  });
  const maxSeq = await maxRoomSeq(msg.room_id);
  await setRoomFederationState(msg.room_id, maxSeq);
  return inserted;
}

export async function applyFederatedRoomReplica(input: {
  room_id: string;
  title: string;
  owner_public_id: string;
  members: Array<{ public_id: string; muted?: boolean }>;
}): Promise<void> {
  const members: RoomMembersJson = input.members.map((m) => ({
    public_id: m.public_id,
    ...(m.muted != null ? { muted: m.muted } : {}),
  }));
  await upsertRoomReplica({
    id: input.room_id,
    title: input.title,
    owner_public_id: input.owner_public_id,
    members,
  });
  const state = await getRoomFederationState(input.room_id);
  if (!state) await setRoomFederationState(input.room_id, 0);
}

export async function getRoomSyncStatus(roomId: string): Promise<RoomSyncStatusPayload | null> {
  const row = await getRoom(roomId);
  if (!row) return null;
  const mode = row.federation_mode ?? "local";
  if (mode === "local") {
    return {
      room_id: roomId,
      federation_mode: "local",
      hub_reachable: true,
      last_synced_seq: null,
      latest_seq: null,
      behind_count: null,
      status: "local",
    };
  }

  const role = federationRoleNow();
  const latest = await maxRoomSeq(roomId);
  const state = await getRoomFederationState(roomId);
  const lastSynced = state?.last_synced_seq ?? (role === "hub" ? latest : 0);

  if (role === "hub") {
    return {
      room_id: roomId,
      federation_mode: "federated",
      hub_reachable: true,
      last_synced_seq: latest,
      latest_seq: latest,
      behind_count: 0,
      status: "synced",
    };
  }

  const hubOk = isHubReachableForSatellite();
  if (!hubOk) {
    return {
      room_id: roomId,
      federation_mode: "federated",
      hub_reachable: false,
      last_synced_seq: lastSynced,
      latest_seq: latest,
      behind_count: null,
      status: "hub_unavailable",
    };
  }

  // Satellite 本地 latest 即已追赶的副本；落后由 catch_up 后收敛
  const behind = Math.max(0, latest - lastSynced);
  return {
    room_id: roomId,
    federation_mode: "federated",
    hub_reachable: true,
    last_synced_seq: lastSynced,
    latest_seq: latest,
    behind_count: behind,
    status: behind > 0 ? "behind" : "synced",
  };
}

export async function catchUpMessagesFromHubDb(
  roomId: string,
  fromSeq: number,
): Promise<RoomMessagePayload[]> {
  const rows = await listRoomMessagesAfterSeq(roomId, fromSeq);
  return rows.map((r) => ({
    id: r.id,
    room_id: r.room_id,
    seq: r.seq,
    speaker_public_id: r.speaker_public_id,
    text: r.payload.text,
    ...(r.payload.tool_summary ? { tool_summary: r.payload.tool_summary } : {}),
    ...(r.payload.mention_public_ids ? { mention_public_ids: r.payload.mention_public_ids } : {}),
    created_at: r.created_at.toISOString(),
  }));
}

/** 从 RoomSummary 广播用的精简成员 */
export function membersFromSummary(summary: RoomSummaryPayload): RoomMembersJson {
  return summary.members.map((m) => ({
    public_id: m.public_id,
    ...(m.muted != null ? { muted: m.muted } : {}),
  }));
}
