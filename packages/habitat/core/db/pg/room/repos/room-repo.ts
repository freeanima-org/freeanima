import { and, asc, desc, eq, lt, max, sql } from "drizzle-orm";

import { getDb } from "../../client.ts";
import {
  roomMessages,
  rooms,
  type RoomMemberJson,
  type RoomMembersJson,
  type RoomPublicPayload,
} from "@freeanima/habitat/core/db/schema";

const now = (): Date => new Date();

export type RoomRow = typeof rooms.$inferSelect;
export type RoomMessageRow = typeof roomMessages.$inferSelect;

export async function insertRoom(input: {
  id: string;
  title: string;
  owner_public_id: string;
  members: RoomMembersJson;
}): Promise<RoomRow> {
  const db = getDb();
  const ts = now();
  const rows = await db
    .insert(rooms)
    .values({
      id: input.id,
      title: input.title,
      owner_public_id: input.owner_public_id,
      members: input.members,
      speaker_public_id: null,
      speaker_heartbeat_at: null,
      speaker_lease_until: null,
      created_at: ts,
      updated_at: ts,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error("insertRoom failed");
  return row;
}

export async function getRoom(roomId: string): Promise<RoomRow | null> {
  const db = getDb();
  const rows = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  return rows[0] ?? null;
}

export async function listRooms(opts?: {
  offset?: number;
  limit?: number;
}): Promise<{ rows: RoomRow[]; total: number }> {
  const db = getDb();
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;
  const countRows = await db.select({ c: sql<number>`count(*)::int` }).from(rooms);
  const total = countRows[0]?.c ?? 0;
  const rows = await db
    .select()
    .from(rooms)
    .orderBy(desc(rooms.updated_at))
    .limit(limit)
    .offset(offset);
  return { rows, total };
}

export async function updateRoomMembers(
  roomId: string,
  members: RoomMembersJson,
): Promise<RoomRow | null> {
  const db = getDb();
  const rows = await db
    .update(rooms)
    .set({ members, updated_at: now() })
    .where(eq(rooms.id, roomId))
    .returning();
  return rows[0] ?? null;
}

export async function updateRoomTitle(roomId: string, title: string): Promise<RoomRow | null> {
  const db = getDb();
  const rows = await db
    .update(rooms)
    .set({ title, updated_at: now() })
    .where(eq(rooms.id, roomId))
    .returning();
  return rows[0] ?? null;
}

export async function deleteRoom(roomId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db.delete(rooms).where(eq(rooms.id, roomId)).returning({ id: rooms.id });
  return rows.length > 0;
}

export async function setSpeakerLease(input: {
  room_id: string;
  speaker_public_id: string | null;
  heartbeat_at: Date | null;
  lease_until: Date | null;
}): Promise<RoomRow | null> {
  const db = getDb();
  const rows = await db
    .update(rooms)
    .set({
      speaker_public_id: input.speaker_public_id,
      speaker_heartbeat_at: input.heartbeat_at,
      speaker_lease_until: input.lease_until,
      updated_at: now(),
    })
    .where(eq(rooms.id, input.room_id))
    .returning();
  return rows[0] ?? null;
}

export async function nextRoomSeq(roomId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ m: max(roomMessages.seq) })
    .from(roomMessages)
    .where(eq(roomMessages.room_id, roomId));
  const current = rows[0]?.m;
  return (current ?? 0) + 1;
}

export async function appendRoomMessage(input: {
  id: string;
  room_id: string;
  speaker_public_id: string;
  payload: RoomPublicPayload;
}): Promise<RoomMessageRow> {
  const db = getDb();
  return await db.transaction(async (tx) => {
    const maxRows = await tx
      .select({ m: max(roomMessages.seq) })
      .from(roomMessages)
      .where(eq(roomMessages.room_id, input.room_id));
    const seq = (maxRows[0]?.m ?? 0) + 1;
    const ts = now();
    const inserted = await tx
      .insert(roomMessages)
      .values({
        id: input.id,
        room_id: input.room_id,
        seq,
        speaker_public_id: input.speaker_public_id,
        payload: input.payload,
        created_at: ts,
      })
      .returning();
    const row = inserted[0];
    if (!row) throw new Error("appendRoomMessage failed");
    await tx.update(rooms).set({ updated_at: ts }).where(eq(rooms.id, input.room_id));
    return row;
  });
}

export async function listRoomMessages(input: {
  room_id: string;
  before_seq?: number;
  limit?: number;
}): Promise<RoomMessageRow[]> {
  const db = getDb();
  const limit = input.limit ?? 50;
  const cond =
    input.before_seq != null
      ? and(eq(roomMessages.room_id, input.room_id), lt(roomMessages.seq, input.before_seq))
      : eq(roomMessages.room_id, input.room_id);
  const rows = await db
    .select()
    .from(roomMessages)
    .where(cond)
    .orderBy(desc(roomMessages.seq))
    .limit(limit);
  return rows.toReversed();
}

export async function listRoomMessagesAfterSeq(
  roomId: string,
  afterSeq: number,
): Promise<RoomMessageRow[]> {
  const db = getDb();
  return db
    .select()
    .from(roomMessages)
    .where(and(eq(roomMessages.room_id, roomId), sql`${roomMessages.seq} > ${afterSeq}`))
    .orderBy(asc(roomMessages.seq));
}

export function memberPublicIds(members: RoomMembersJson): string[] {
  return members.map((m: RoomMemberJson) => m.public_id);
}
