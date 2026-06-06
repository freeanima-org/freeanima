import { sql, type SQL } from "drizzle-orm";
import { bigint, customType, index, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import type { MessagePayload } from "./jsonb/message-payload.ts";
import { sessions } from "./sessions.ts";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

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
    /** STORED 生成列；全文检索输入（message_fts_input + simple 配置） */
    contentFts: tsvector("content_fts").generatedAlwaysAs(
      (): SQL => sql`CASE
        WHEN (${messages.payload})->>'role' IN ('user', 'assistant')
          AND length(btrim((${messages.payload})->>'content')) > 0
        THEN to_tsvector('simple', message_fts_input((${messages.payload})->>'content'))
        ELSE NULL
      END`,
    ),
  },
  (t) => [
    uniqueIndex("messages_session_id_pos_uidx").on(t.sessionId, t.pos),
    index("messages_content_fts_gin").using("gin", t.contentFts),
  ],
);
