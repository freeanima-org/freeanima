/**
 * 群聊首条公开消息 → LLM 生成 rooms.title，并同步各内心席会话标题。
 */

import { fallbackConversationTitle, generateConversationTitle } from "@freeanima/habitat/core/llm";
import { getDb } from "@freeanima/habitat/core/db/pg/client.ts";
import { conversations } from "@freeanima/habitat/core/db/schema";
import { eq } from "drizzle-orm";
import { getRoom, updateRoomTitle } from "@freeanima/habitat/core/db/pg/room";
import { listEntities } from "@freeanima/habitat/core/db/pg/entity";
import { agentConfigBodySchema } from "@freeanima/habitat/core/db/schema/entity";

import { formatRoomInnerConversationTitle, isRoomTitlePendingLlm } from "./room-title.ts";

const roomTitleInFlight = new Set<string>();

function subjectPublicId(body: unknown): string | null {
  const parsed = agentConfigBodySchema.safeParse(body);
  if (!parsed.success) return null;
  const id = parsed.data.public_id?.trim();
  return id || null;
}

async function agentLabelForPublicId(publicId: string): Promise<string> {
  const agents = await listEntities({ type: "agent", limit: 200 });
  for (const row of agents) {
    if (subjectPublicId(row.body) === publicId) {
      const t = row.title.trim();
      if (t) return t;
    }
  }
  return publicId.length <= 10 ? publicId : `${publicId.slice(0, 6)}…`;
}

/** 按当前 Room 标题刷新该房全部内心席 conversation.title */
export async function syncRoomInnerConversationTitles(roomId: string): Promise<void> {
  const room = await getRoom(roomId);
  if (!room) return;
  const db = getDb();
  const seats = await db
    .select({
      id: conversations.id,
      agent_public_id: conversations.agent_public_id,
    })
    .from(conversations)
    .where(eq(conversations.room_id, roomId));

  for (const seat of seats) {
    const agentPid = seat.agent_public_id?.trim();
    if (!agentPid) continue;
    const label = await agentLabelForPublicId(agentPid);
    const title = formatRoomInnerConversationTitle(room.title, label);
    await db.update(conversations).set({ title }).where(eq(conversations.id, seat.id));
  }
}

/** 首条公开消息（seq=1）且标题仍为占位时异步生成群名。 */
export function maybeGenerateRoomTitleFromFirstMessage(
  roomId: string,
  text: string,
  seq: number,
): void {
  if (seq !== 1) return;
  const trimmed = text.trim();
  if (!trimmed) return;
  if (roomTitleInFlight.has(roomId)) return;
  roomTitleInFlight.add(roomId);

  void (async () => {
    try {
      const room = await getRoom(roomId);
      if (!room || !isRoomTitlePendingLlm(room.title)) return;

      const gen = await generateConversationTitle(trimmed, {
        parentConversationId: `room:${roomId}`,
      });
      let title = gen.ok ? gen.title : "";
      if (!title) title = fallbackConversationTitle(trimmed);
      if (!title) return;

      const still = await getRoom(roomId);
      if (!still || !isRoomTitlePendingLlm(still.title)) return;

      await updateRoomTitle(roomId, title);
      await syncRoomInnerConversationTitles(roomId);
    } catch {
      /* 标题失败不阻断发言 */
    } finally {
      roomTitleInFlight.delete(roomId);
    }
  })();
}

/** @internal */
export function resetRoomTitleGenerationForTests(): void {
  roomTitleInFlight.clear();
}
