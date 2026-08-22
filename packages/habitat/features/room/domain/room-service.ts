import { and, eq, isNotNull } from "drizzle-orm";

import { randomPublicId } from "@freeanima/shared/util/random-public-id.ts";
import { getDb } from "@freeanima/habitat/core/db/pg/client.ts";
import {
  appendRoomMessage,
  deleteRoom,
  getRoom,
  insertRoom,
  listRoomMessages,
  listRoomMessagesAfterSeq,
  listRooms,
  setSpeakerLease,
  updateRoomMembers,
  type RoomRow,
} from "@freeanima/habitat/core/db/pg/room";
import { conversations } from "@freeanima/habitat/core/db/schema";
import type { RoomMembersJson } from "@freeanima/habitat/core/db/schema";
import { listEntities } from "@freeanima/habitat/core/db/pg/entity";
import { agentConfigBodySchema } from "@freeanima/habitat/core/db/schema/entity";
import { resolveContactByPublicId } from "@freeanima/features/contact/domain/index.ts";
import { getResolvedWorldContext } from "@freeanima/habitat/core/config/resolved-world-context.ts";
import { appendMessage } from "@freeanima/habitat/engine/conversation/conversation-crud.ts";
import { PROMPT_XML_TAGS, wrapPromptXml } from "@freeanima/habitat/core/hooks/prompt";
import type {
  RoomMemberPayload,
  RoomMessagePayload,
  RoomSummaryPayload,
} from "@freeanima/shared/rpc-contract/frames/room.ts";

import { formatRoomInnerConversationTitle } from "./room-title.ts";
import { maybeGenerateRoomTitleFromFirstMessage } from "./room-title-generate.ts";

/** 发言席硬超时（毫秒）；流式回合在 acquire 时用更长租约 */
export const ROOM_SPEAKER_LEASE_MS = 120_000;
export const ROOM_SPEAKER_STREAM_LEASE_MS = 600_000;
/** 心跳续租间隔预期（毫秒） */
export const ROOM_SPEAKER_HEARTBEAT_MS = 15_000;

const ROOM_PLATFORM = "chat";

export type RoomDomainDeps = {
  newConversation: (
    platform: string,
    model?: string,
    platformExtra?: Record<string, unknown>,
    scenario?: "digital_human" | "coding_agent" | "room_inner",
    agentSubjectId?: number,
  ) => Promise<string>;
  /** 打断进行中的内心 Conversation */
  interruptConversation?: (conversationId: string) => void;
};

function subjectPublicId(body: unknown): string | null {
  const parsed = agentConfigBodySchema.safeParse(body);
  if (!parsed.success) return null;
  const id = parsed.data.public_id?.trim();
  return id || null;
}

/** 本机 agent：public_id → subject id */
export async function resolveLocalAgentSubjectId(publicId: string): Promise<number | null> {
  const agents = await listEntities({ type: "agent", limit: 200 });
  for (const row of agents) {
    if (subjectPublicId(row.body) === publicId) return row.id;
  }
  return null;
}

export async function resolveLocalUserPublicId(): Promise<string | null> {
  const users = await listEntities({ type: "user", limit: 5 });
  const user = users[0];
  if (!user) return null;
  return subjectPublicId(user.body);
}

async function displayNameForPublicId(publicId: string): Promise<string | undefined> {
  try {
    const commonsId = getResolvedWorldContext().commons_world_id;
    const contact = await resolveContactByPublicId(commonsId, publicId);
    if (contact?.title?.trim()) return contact.title.trim();
  } catch {
    /* ignore */
  }
  const agents = await listEntities({ type: "agent", limit: 200 });
  for (const row of agents) {
    if (subjectPublicId(row.body) === publicId) {
      const t = row.title.trim();
      if (t) return t;
    }
  }
  const users = await listEntities({ type: "user", limit: 5 });
  for (const row of users) {
    if (subjectPublicId(row.body) === publicId) {
      const t = row.title.trim();
      if (t) return t;
    }
  }
  return undefined;
}

async function enrichMembers(members: RoomMembersJson): Promise<RoomMemberPayload[]> {
  const out: RoomMemberPayload[] = [];
  for (const m of members) {
    const agentId = await resolveLocalAgentSubjectId(m.public_id);
    const display_name = await displayNameForPublicId(m.public_id);
    out.push({
      public_id: m.public_id,
      ...(m.muted != null ? { muted: m.muted } : {}),
      ...(display_name ? { display_name } : {}),
      is_local_agent: agentId != null,
    });
  }
  return out;
}

async function toRoomSummary(row: RoomRow): Promise<RoomSummaryPayload> {
  const members = await enrichMembers(row.members ?? []);
  return {
    room_id: row.id,
    title: row.title,
    owner_public_id: row.owner_public_id,
    members,
    speaker_public_id: row.speaker_public_id,
    speaker_lease_until: row.speaker_lease_until?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

async function toRoomMessage(row: {
  id: string;
  room_id: string;
  seq: number;
  speaker_public_id: string;
  payload: { text: string; tool_summary?: string; mention_public_ids?: string[] };
  created_at: Date;
}): Promise<RoomMessagePayload> {
  const speaker_display_name = await displayNameForPublicId(row.speaker_public_id);
  return {
    id: row.id,
    room_id: row.room_id,
    seq: row.seq,
    speaker_public_id: row.speaker_public_id,
    ...(speaker_display_name ? { speaker_display_name } : {}),
    text: row.payload.text,
    ...(row.payload.tool_summary ? { tool_summary: row.payload.tool_summary } : {}),
    ...(row.payload.mention_public_ids
      ? { mention_public_ids: row.payload.mention_public_ids }
      : {}),
    created_at: row.created_at.toISOString(),
  };
}

/** 群聊公开句投影进内心 user.content 的 XML 包装（非一对一密语）。 */
export function formatRoomUtteranceContent(
  speakerDisplayName: string,
  publicId: string,
  text: string,
): string {
  return wrapPromptXml(PROMPT_XML_TAGS.roomUtterance, text, {
    attrs: {
      speaker: speakerDisplayName.trim() || publicId,
      public_id: publicId,
    },
  });
}

export type RoomMembersPromptInput = {
  members: RoomMemberPayload[];
  /** 本内心席绑定的 agent public_id（花名册 self=true） */
  self_public_id?: string | null;
};

export type RoomMemberPromptRow = {
  public_id: string;
  kind: "agent" | "user";
  display_name: string;
  subject_id?: number;
  self: boolean;
};

/** 花名册内层正文（纯渲染；不含外层 room_members 包裹）。 */
export function formatRoomMembersPromptBody(rows: RoomMemberPromptRow[]): string {
  const lines: string[] = [];
  for (const row of rows) {
    const publicId = row.public_id.trim();
    if (!publicId) continue;
    const attrs: Record<string, string> = {
      public_id: publicId,
      kind: row.kind,
      self: row.self ? "true" : "false",
    };
    if (row.subject_id != null) attrs.subject_id = String(row.subject_id);
    const label = row.display_name.trim() || publicId;
    const line = wrapPromptXml("member", label, { inline: true, attrs });
    if (line) lines.push(line);
  }
  return lines.join("\n");
}

/**
 * 解析成员身份后渲染花名册内层。
 * kind=user 为本实例唯一人类用户；kind=agent 为 Anima；subject_id 仅本机可解析时写入。
 */
export async function buildRoomMembersPromptBody(input: RoomMembersPromptInput): Promise<string> {
  const localUserPublicId = await resolveLocalUserPublicId();
  let localUserSubjectId: number | undefined;
  try {
    localUserSubjectId = getResolvedWorldContext().user_subject_id;
  } catch {
    localUserSubjectId = undefined;
  }
  const selfId = input.self_public_id?.trim() || null;
  const rows: RoomMemberPromptRow[] = [];
  for (const m of input.members) {
    const publicId = m.public_id.trim();
    if (!publicId) continue;
    const agentSubjectId = await resolveLocalAgentSubjectId(publicId);
    const isUser = localUserPublicId != null && publicId === localUserPublicId;
    const kind = isUser ? "user" : "agent";
    const subjectId =
      agentSubjectId != null
        ? agentSubjectId
        : isUser && localUserSubjectId != null
          ? localUserSubjectId
          : undefined;
    rows.push({
      public_id: publicId,
      kind,
      display_name: m.display_name?.trim() || publicId,
      ...(subjectId != null ? { subject_id: subjectId } : {}),
      self: selfId != null && publicId === selfId,
    });
  }
  return formatRoomMembersPromptBody(rows);
}

/** 成员变更后清空该房内心席系统提示缓存，下次 turn 重建花名册。 */
export async function invalidateRoomInnerSystemPrompts(roomId: string): Promise<void> {
  const db = getDb();
  await db
    .update(conversations)
    .set({ system_prompt_built_at: null })
    .where(and(eq(conversations.room_id, roomId), eq(conversations.scenario, "room_inner")));
}

async function ensureAgentSeat(
  deps: RoomDomainDeps,
  roomId: string,
  agentPublicId: string,
): Promise<string | null> {
  const agentSubjectId = await resolveLocalAgentSubjectId(agentPublicId);
  if (agentSubjectId == null) return null;

  const db = getDb();
  const existing = await db
    .select({ id: conversations.id, scenario: conversations.scenario })
    .from(conversations)
    .where(and(eq(conversations.room_id, roomId), eq(conversations.agent_public_id, agentPublicId)))
    .limit(1);
  if (existing[0]?.id) {
    const conversationId = existing[0].id;
    if (existing[0].scenario !== "room_inner") {
      // 旧席补 scenario，并清空 built_at 以便下次 turn 重建系统提示（含群聊协议段）
      await db
        .update(conversations)
        .set({ scenario: "room_inner", system_prompt_built_at: null })
        .where(eq(conversations.id, conversationId));
    }
    const titleRows = await db
      .select({ title: conversations.title })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    if (!titleRows[0]?.title?.trim()) {
      const room = await getRoom(roomId);
      const agentLabel = (await displayNameForPublicId(agentPublicId)) ?? agentPublicId;
      await db
        .update(conversations)
        .set({
          title: formatRoomInnerConversationTitle(room?.title ?? "群聊", agentLabel),
        })
        .where(eq(conversations.id, conversationId));
    }
    return conversationId;
  }

  const conversationId = await deps.newConversation(
    ROOM_PLATFORM,
    undefined,
    { room_id: roomId },
    "room_inner",
    agentSubjectId,
  );
  const room = await getRoom(roomId);
  const agentLabel = (await displayNameForPublicId(agentPublicId)) ?? agentPublicId;
  const seatTitle = formatRoomInnerConversationTitle(room?.title ?? "群聊", agentLabel);
  await db
    .update(conversations)
    .set({
      room_id: roomId,
      agent_public_id: agentPublicId,
      last_projected_room_seq: 0,
      scenario: "room_inner",
      title: seatTitle,
    })
    .where(eq(conversations.id, conversationId));
  return conversationId;
}

/** 对外：确保本机 agent 房间内心席（不抢发言席） */
export async function ensureRoomAgentConversation(
  deps: RoomDomainDeps,
  roomId: string,
  agentPublicId: string,
): Promise<{ ok: true; conversation_id: string } | { ok: false; reason: string }> {
  const row = await getRoom(roomId);
  if (!row) return { ok: false, reason: "ROOM_NOT_FOUND" };
  const member = (row.members ?? []).find((m) => m.public_id === agentPublicId);
  if (!member) return { ok: false, reason: "NOT_A_MEMBER" };
  const conversationId = await ensureAgentSeat(deps, roomId, agentPublicId);
  if (!conversationId) return { ok: false, reason: "NOT_LOCAL_AGENT" };
  return { ok: true, conversation_id: conversationId };
}

export async function findConversationIdForRoomAgent(
  roomId: string,
  agentPublicId: string,
): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.room_id, roomId), eq(conversations.agent_public_id, agentPublicId)))
    .limit(1);
  return rows[0]?.id ?? null;
}

/** 增量投影：Room 公开句 → 内心 messages（按 pos 交错） */
export async function projectRoomIntoConversation(
  roomId: string,
  conversationId: string,
  agentPublicId: string,
): Promise<void> {
  const db = getDb();
  const metaRows = await db
    .select({
      last: conversations.last_projected_room_seq,
      agent_subject_id: conversations.agent_subject_id,
    })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  const meta = metaRows[0];
  if (!meta) return;
  const after = meta.last ?? 0;
  const pending = await listRoomMessagesAfterSeq(roomId, after);
  let maxSeq = after;
  for (const msg of pending) {
    maxSeq = Math.max(maxSeq, msg.seq);
    if (msg.speaker_public_id === agentPublicId) {
      // 本席公开回复应已在回写时写入 assistant；跳过避免重复
      continue;
    }
    const name = (await displayNameForPublicId(msg.speaker_public_id)) ?? msg.speaker_public_id;
    await appendMessage(
      {
        role: "user",
        content: formatRoomUtteranceContent(name, msg.speaker_public_id, msg.payload.text),
        name,
      },
      conversationId,
    );
  }
  if (maxSeq > after) {
    await db
      .update(conversations)
      .set({ last_projected_room_seq: maxSeq })
      .where(eq(conversations.id, conversationId));
  }
}

function leaseExpired(row: RoomRow, at: Date): boolean {
  if (!row.speaker_public_id) return true;
  if (!row.speaker_lease_until) return true;
  return row.speaker_lease_until.getTime() <= at.getTime();
}

export async function createRoom(
  deps: RoomDomainDeps,
  input: { title: string; owner_public_id: string; member_public_ids: string[] },
): Promise<RoomSummaryPayload> {
  const ids = [...new Set(input.member_public_ids.map((x) => x.trim()).filter(Boolean))];
  if (!ids.includes(input.owner_public_id)) ids.unshift(input.owner_public_id);
  const members: RoomMembersJson = ids.map((public_id) => ({ public_id }));
  const roomId = randomPublicId();
  const row = await insertRoom({
    id: roomId,
    title: input.title.trim(),
    owner_public_id: input.owner_public_id,
    members,
  });
  for (const m of members) {
    await ensureAgentSeat(deps, roomId, m.public_id);
  }
  return toRoomSummary(row);
}

export async function getRoomSummary(roomId: string): Promise<RoomSummaryPayload | null> {
  const row = await getRoom(roomId);
  if (!row) return null;
  return toRoomSummary(row);
}

export async function listRoomSummaries(opts?: {
  offset?: number;
  limit?: number;
}): Promise<{ rooms: RoomSummaryPayload[]; total: number }> {
  const { rows, total } = await listRooms(opts);
  const rooms = await Promise.all(rows.map((r) => toRoomSummary(r)));
  return { rooms, total };
}

export async function disbandRoom(roomId: string, actorPublicId: string): Promise<void> {
  const row = await getRoom(roomId);
  if (!row) throw new Error("ROOM_NOT_FOUND");
  if (row.owner_public_id !== actorPublicId) throw new Error("FORBIDDEN_NOT_OWNER");
  const db = getDb();
  await db
    .update(conversations)
    .set({ room_id: null })
    .where(and(eq(conversations.room_id, roomId), isNotNull(conversations.room_id)));
  await deleteRoom(roomId);
}

export async function addRoomMembers(
  deps: RoomDomainDeps,
  input: { room_id: string; actor_public_id: string; member_public_ids: string[] },
): Promise<RoomSummaryPayload> {
  const row = await getRoom(input.room_id);
  if (!row) throw new Error("ROOM_NOT_FOUND");
  if (row.owner_public_id !== input.actor_public_id) throw new Error("FORBIDDEN_NOT_OWNER");
  const set = new Set((row.members ?? []).map((m) => m.public_id));
  for (const id of input.member_public_ids) {
    const p = id.trim();
    if (p) set.add(p);
  }
  const members: RoomMembersJson = [...set].map((public_id) => ({ public_id }));
  const updated = await updateRoomMembers(input.room_id, members);
  if (!updated) throw new Error("ROOM_NOT_FOUND");
  for (const m of members) {
    await ensureAgentSeat(deps, input.room_id, m.public_id);
  }
  await invalidateRoomInnerSystemPrompts(input.room_id);
  return toRoomSummary(updated);
}

export async function kickRoomMember(
  _deps: RoomDomainDeps,
  input: { room_id: string; actor_public_id: string; member_public_id: string },
): Promise<RoomSummaryPayload> {
  const row = await getRoom(input.room_id);
  if (!row) throw new Error("ROOM_NOT_FOUND");
  if (row.owner_public_id !== input.actor_public_id) throw new Error("FORBIDDEN_NOT_OWNER");
  if (input.member_public_id === row.owner_public_id) throw new Error("CANNOT_KICK_OWNER");
  const members = (row.members ?? []).filter((m) => m.public_id !== input.member_public_id);
  const updated = await updateRoomMembers(input.room_id, members);
  if (!updated) throw new Error("ROOM_NOT_FOUND");
  const db = getDb();
  await db
    .update(conversations)
    .set({ room_id: null, archived_at: new Date() })
    .where(
      and(
        eq(conversations.room_id, input.room_id),
        eq(conversations.agent_public_id, input.member_public_id),
      ),
    );
  await invalidateRoomInnerSystemPrompts(input.room_id);
  return toRoomSummary(updated);
}

export async function leaveRoom(
  _deps: RoomDomainDeps,
  input: { room_id: string; actor_public_id: string },
): Promise<void> {
  const row = await getRoom(input.room_id);
  if (!row) throw new Error("ROOM_NOT_FOUND");
  if (row.owner_public_id === input.actor_public_id) {
    throw new Error("OWNER_MUST_DISBAND");
  }
  const members = (row.members ?? []).filter((m) => m.public_id !== input.actor_public_id);
  await updateRoomMembers(input.room_id, members);
  const db = getDb();
  await db
    .update(conversations)
    .set({ room_id: null, archived_at: new Date() })
    .where(
      and(
        eq(conversations.room_id, input.room_id),
        eq(conversations.agent_public_id, input.actor_public_id),
      ),
    );
  await invalidateRoomInnerSystemPrompts(input.room_id);
}

export async function listMessages(
  roomId: string,
  opts?: { before_seq?: number; limit?: number },
): Promise<RoomMessagePayload[]> {
  const rows = await listRoomMessages({
    room_id: roomId,
    ...(opts?.before_seq != null ? { before_seq: opts.before_seq } : {}),
    ...(opts?.limit != null ? { limit: opts.limit } : {}),
  });
  return Promise.all(rows.map((r) => toRoomMessage(r)));
}

export async function sendHumanMessage(
  _deps: RoomDomainDeps,
  input: {
    room_id: string;
    speaker_public_id: string;
    text: string;
    mention_public_ids?: string[];
  },
): Promise<{ message: RoomMessagePayload; mention_local_agent_ids: string[] }> {
  const row = await getRoom(input.room_id);
  if (!row) throw new Error("ROOM_NOT_FOUND");
  const memberIds = new Set((row.members ?? []).map((m) => m.public_id));
  if (!memberIds.has(input.speaker_public_id)) throw new Error("NOT_A_MEMBER");

  const msgRow = await appendRoomMessage({
    id: randomPublicId(),
    room_id: input.room_id,
    speaker_public_id: input.speaker_public_id,
    payload: {
      text: input.text,
      ...(input.mention_public_ids?.length ? { mention_public_ids: input.mention_public_ids } : {}),
    },
  });
  maybeGenerateRoomTitleFromFirstMessage(input.room_id, input.text, msgRow.seq);
  const message = await toRoomMessage(msgRow);

  const mention_local_agent_ids: string[] = [];
  for (const agentPublicId of input.mention_public_ids ?? []) {
    if (await resolveLocalAgentSubjectId(agentPublicId)) {
      mention_local_agent_ids.push(agentPublicId);
    }
  }
  return { message, mention_local_agent_ids };
}

export async function acquireSpeaker(
  roomId: string,
  agentPublicId: string,
  opts?: { lease_ms?: number },
): Promise<{
  ok: boolean;
  speaker_public_id: string | null;
  speaker_lease_until?: string;
  reason?: string;
}> {
  const row = await getRoom(roomId);
  if (!row) return { ok: false, speaker_public_id: null, reason: "ROOM_NOT_FOUND" };
  const at = new Date();
  if (!leaseExpired(row, at) && row.speaker_public_id && row.speaker_public_id !== agentPublicId) {
    return {
      ok: false,
      speaker_public_id: row.speaker_public_id,
      ...(row.speaker_lease_until
        ? { speaker_lease_until: row.speaker_lease_until.toISOString() }
        : {}),
      reason: "SPEAKER_BUSY",
    };
  }
  const leaseMs = opts?.lease_ms ?? ROOM_SPEAKER_LEASE_MS;
  const leaseUntil = new Date(at.getTime() + leaseMs);
  const updated = await setSpeakerLease({
    room_id: roomId,
    speaker_public_id: agentPublicId,
    heartbeat_at: at,
    lease_until: leaseUntil,
  });
  return {
    ok: true,
    speaker_public_id: agentPublicId,
    ...(updated?.speaker_lease_until
      ? { speaker_lease_until: updated.speaker_lease_until.toISOString() }
      : {}),
  };
}

export async function heartbeatSpeaker(
  roomId: string,
  agentPublicId: string,
): Promise<{ ok: boolean; speaker_lease_until?: string }> {
  const row = await getRoom(roomId);
  if (!row || row.speaker_public_id !== agentPublicId) return { ok: false };
  const at = new Date();
  const leaseUntil = new Date(at.getTime() + ROOM_SPEAKER_LEASE_MS);
  const updated = await setSpeakerLease({
    room_id: roomId,
    speaker_public_id: agentPublicId,
    heartbeat_at: at,
    lease_until: leaseUntil,
  });
  return {
    ok: true,
    ...(updated?.speaker_lease_until
      ? { speaker_lease_until: updated.speaker_lease_until.toISOString() }
      : {}),
  };
}

export async function turnCompleteSpeaker(roomId: string, agentPublicId: string): Promise<void> {
  const row = await getRoom(roomId);
  if (!row) return;
  if (row.speaker_public_id !== agentPublicId) return;
  await setSpeakerLease({
    room_id: roomId,
    speaker_public_id: null,
    heartbeat_at: null,
    lease_until: null,
  });
}

export async function interruptSpeaker(
  deps: RoomDomainDeps,
  roomId: string,
  _actorPublicId: string,
): Promise<void> {
  const row = await getRoom(roomId);
  if (!row?.speaker_public_id) return;
  const conversationId = await findConversationIdForRoomAgent(roomId, row.speaker_public_id);
  if (conversationId && deps.interruptConversation) {
    deps.interruptConversation(conversationId);
  }
  await setSpeakerLease({
    room_id: roomId,
    speaker_public_id: null,
    heartbeat_at: null,
    lease_until: null,
  });
}

/**
 * 准备 Agent 流式回合：抢令牌 → 确保席位 → 增量投影。
 * 真正的 LLM 流由 habitat routes 泵；结束后调用 writebackAgentPublicReply。
 */
export async function prepareAgentTurn(
  deps: RoomDomainDeps,
  input: { room_id: string; agent_public_id: string },
): Promise<{
  ok: boolean;
  conversation_id?: string;
  /** continue = 内心末条已是 user；send = 需补一条私有 cue */
  stream_mode?: "continue" | "send";
  reason?: string;
}> {
  const acq = await acquireSpeaker(input.room_id, input.agent_public_id, {
    lease_ms: ROOM_SPEAKER_STREAM_LEASE_MS,
  });
  if (!acq.ok) return { ok: false, reason: acq.reason ?? "SPEAKER_BUSY" };

  let conversationId = await findConversationIdForRoomAgent(input.room_id, input.agent_public_id);
  if (!conversationId) {
    conversationId = await ensureAgentSeat(deps, input.room_id, input.agent_public_id);
  }
  if (!conversationId) {
    await turnCompleteSpeaker(input.room_id, input.agent_public_id);
    return { ok: false, reason: "NO_LOCAL_AGENT_SEAT" };
  }

  try {
    await projectRoomIntoConversation(input.room_id, conversationId, input.agent_public_id);
    const { getLastMessageRole } =
      await import("@freeanima/habitat/engine/conversation/conversation-crud.ts");
    const lastRole = await getLastMessageRole(conversationId);
    const stream_mode = lastRole === "user" ? "continue" : "send";
    return { ok: true, conversation_id: conversationId, stream_mode };
  } catch (e) {
    await turnCompleteSpeaker(input.room_id, input.agent_public_id);
    return { ok: false, conversation_id: conversationId, reason: String(e) };
  }
}

/** 流结束后把公开回复写入 Room（内心 assistant 已由 finishTurn 落库）。 */
export async function writebackAgentPublicReply(input: {
  room_id: string;
  agent_public_id: string;
  conversation_id: string;
  text: string;
}): Promise<RoomMessagePayload | null> {
  const text = input.text.trim();
  if (!text) {
    await turnCompleteSpeaker(input.room_id, input.agent_public_id);
    return null;
  }

  const msgRow = await appendRoomMessage({
    id: randomPublicId(),
    room_id: input.room_id,
    speaker_public_id: input.agent_public_id,
    payload: { text },
  });
  maybeGenerateRoomTitleFromFirstMessage(input.room_id, text, msgRow.seq);

  const db = getDb();
  await db
    .update(conversations)
    .set({ last_projected_room_seq: msgRow.seq })
    .where(eq(conversations.id, input.conversation_id));

  await turnCompleteSpeaker(input.room_id, input.agent_public_id);
  return toRoomMessage(msgRow);
}

/** @deprecated 同步占位路径已移除；请用 prepareAgentTurn + 流式泵 */
export async function runAgentTurn(
  deps: RoomDomainDeps,
  input: { room_id: string; agent_public_id: string },
): Promise<{
  ok: boolean;
  conversation_id?: string;
  reason?: string;
}> {
  const prepared = await prepareAgentTurn(deps, input);
  if (!prepared.ok) {
    return { ok: false, ...(prepared.reason ? { reason: prepared.reason } : {}) };
  }
  return {
    ok: true,
    ...(prepared.conversation_id ? { conversation_id: prepared.conversation_id } : {}),
  };
}
