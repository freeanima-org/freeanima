import { bigint, index, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import type { MessagePayload } from "./jsonb/message-payload.ts";
import { autoLlmRuns } from "./auto-llm-runs.ts";
import { entities } from "./entity/entity.ts";

/** AutoLlmRun 过程消息（与 conversations.messages 互斥；无 FTS / embedding） */
export const autoLlmMessages = pgTable(
  "auto_llm_messages",
  {
    id: text("id").primaryKey(),
    run_id: text("run_id")
      .notNull()
      .references(() => autoLlmRuns.id, { onDelete: "cascade" }),
    /** 与所属 run 相同的行动主体（可空；冗余便于按 subject 扫表） */
    subject_id: bigint("subject_id", { mode: "number" }).references(() => entities.id),
    pos: bigint("pos", { mode: "number" }).notNull(),
    payload: jsonb("payload").$type<MessagePayload>().notNull(),
  },
  (t) => [
    uniqueIndex("auto_llm_messages_run_id_pos_uidx").on(t.run_id, t.pos),
    index("idx_auto_llm_messages_run_id").on(t.run_id),
    index("idx_auto_llm_messages_subject_id").on(t.subject_id),
  ],
);
