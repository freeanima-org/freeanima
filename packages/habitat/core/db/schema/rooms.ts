import { bigint, index, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import { pgTimestamptz } from "./columns/pg-timestamptz.ts";

/** Room 成员条目；muted 等为预留，本任务可不读。 */
export type RoomMemberJson = {
  public_id: string;
  muted?: boolean;
};

export type RoomMembersJson = RoomMemberJson[];

/** 单机群聊公开时间线载体（非 entity）。 */
export const rooms = pgTable(
  "rooms",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    /** 群主 subject public_id */
    owner_public_id: text("owner_public_id").notNull(),
    members: jsonb("members").$type<RoomMembersJson>().notNull().default([]),
    /** 发言席锁：持有者 public_id；空=无人持锁 */
    speaker_public_id: text("speaker_public_id"),
    speaker_heartbeat_at: pgTimestamptz("speaker_heartbeat_at"),
    speaker_lease_until: pgTimestamptz("speaker_lease_until"),
    created_at: pgTimestamptz("created_at").notNull(),
    updated_at: pgTimestamptz("updated_at").notNull(),
  },
  (t) => [
    index("idx_rooms_updated_at").on(t.updated_at.desc()),
    index("idx_rooms_owner_public_id").on(t.owner_public_id),
  ],
);

export type RoomPublicPayload = {
  text: string;
  /** 可选工具摘要（非完整 tool 轨迹） */
  tool_summary?: string;
  /** @ 提及的 public_id 列表 */
  mention_public_ids?: string[];
};

export const roomMessages = pgTable(
  "room_messages",
  {
    id: text("id").primaryKey(),
    room_id: text("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    seq: bigint("seq", { mode: "number" }).notNull(),
    speaker_public_id: text("speaker_public_id").notNull(),
    payload: jsonb("payload").$type<RoomPublicPayload>().notNull(),
    created_at: pgTimestamptz("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("room_messages_room_id_seq_uidx").on(t.room_id, t.seq),
    index("idx_room_messages_room_id").on(t.room_id),
    index("idx_room_messages_speaker_public_id").on(t.speaker_public_id),
  ],
);
