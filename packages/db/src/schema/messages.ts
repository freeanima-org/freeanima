import { bigint, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import type { RolePayload } from "./jsonb/role-payload.js";
import { sessions } from "./sessions.js";

export const messages = pgTable(
  "messages",
  {
    /** 全局唯一行 id（PG 主键；与 JSONL / compression 无关） */
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    /** 会话内单调序号，平替 JSONL 的 `id`（compression l2/l3 指向此值） */
    pos: bigint("pos", { mode: "number" }).notNull(),
    content: text("content").notNull().default(""),
    ts: timestamp("ts", { withTimezone: true, mode: "string" }).notNull(),
    rolePayload: jsonb("role_payload").$type<RolePayload>().notNull(),
  },
  (t) => [uniqueIndex("messages_session_id_pos_uidx").on(t.sessionId, t.pos)],
);
