import { bigint, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import type { MessagePayload } from "./jsonb/message-payload.js";
import { sessions } from "./sessions.js";

export const messages = pgTable(
  "messages",
  {
    /** 全局唯一行 id（PG 主键；compression 指向 pos，非此列） */
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    /** 会话内单调序号（compression l2/l3 指向此值；领域层 Message.pos） */
    pos: bigint("pos", { mode: "number" }).notNull(),
    payload: jsonb("payload").$type<MessagePayload>().notNull(),
  },
  (t) => [uniqueIndex("messages_session_id_pos_uidx").on(t.sessionId, t.pos)],
);
