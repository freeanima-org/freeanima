import { bigint, index, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import type { MessagePayload } from "./jsonb/message-payload.ts";
import { autoLlmRuns } from "./auto-llm-runs.ts";

/** AutoLlmRun 过程消息（与 conversations.messages 互斥；无 FTS / embedding） */
export const autoLlmMessages = pgTable(
  "auto_llm_messages",
  {
    id: text("id").primaryKey(),
    run_id: text("run_id")
      .notNull()
      .references(() => autoLlmRuns.id, { onDelete: "cascade" }),
    pos: bigint("pos", { mode: "number" }).notNull(),
    payload: jsonb("payload").$type<MessagePayload>().notNull(),
  },
  (t) => [
    uniqueIndex("auto_llm_messages_run_id_pos_uidx").on(t.run_id, t.pos),
    index("idx_auto_llm_messages_run_id").on(t.run_id),
  ],
);
