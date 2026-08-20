-- 主体归属统一：bigint entities.id；对话 / AutoLlm / cron / search；校正 text/integer 债
-- 顺序：可空加列 → 回填 → SET NOT NULL → 类型转换 → 索引 / FK
-- 默认 subject：优先 habitat_runtime_config.worlds，否则最低 id 的 user/agent

ALTER TABLE "conversations" ADD COLUMN "agent_subject_id" bigint;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "subject_id" bigint;--> statement-breakpoint
ALTER TABLE "auto_llm_messages" ADD COLUMN "subject_id" bigint;--> statement-breakpoint
ALTER TABLE "cron_jobs" ADD COLUMN "subject_id" bigint;--> statement-breakpoint
ALTER TABLE "search_documents" ADD COLUMN "subject_id" bigint;--> statement-breakpoint

UPDATE "conversations"
SET "agent_subject_id" = COALESCE(
  (SELECT (value->>'agent_subject_id')::bigint FROM habitat_runtime_config WHERE section = 'worlds'),
  (SELECT id FROM entities WHERE type = 'agent' ORDER BY id ASC LIMIT 1)
)
WHERE "agent_subject_id" IS NULL;--> statement-breakpoint

UPDATE "messages"
SET "subject_id" = CASE
  WHEN COALESCE(payload->>'role', '') = 'user' THEN COALESCE(
    (SELECT (value->>'user_subject_id')::bigint FROM habitat_runtime_config WHERE section = 'worlds'),
    (SELECT id FROM entities WHERE type = 'user' ORDER BY id ASC LIMIT 1)
  )
  ELSE COALESCE(
    (SELECT (value->>'agent_subject_id')::bigint FROM habitat_runtime_config WHERE section = 'worlds'),
    (SELECT id FROM entities WHERE type = 'agent' ORDER BY id ASC LIMIT 1)
  )
END
WHERE "subject_id" IS NULL;--> statement-breakpoint

UPDATE "auto_llm_runs"
SET "subject_id" = COALESCE(
  (SELECT (value->>'agent_subject_id')::bigint FROM habitat_runtime_config WHERE section = 'worlds'),
  (SELECT id FROM entities WHERE type = 'agent' ORDER BY id ASC LIMIT 1)
)
WHERE "subject_id" IS NULL;--> statement-breakpoint

ALTER TABLE "auto_llm_runs" ALTER COLUMN "subject_id" SET DATA TYPE bigint USING "subject_id"::bigint;--> statement-breakpoint

UPDATE "auto_llm_messages" m
SET "subject_id" = r."subject_id"
FROM "auto_llm_runs" r
WHERE m."run_id" = r."id" AND m."subject_id" IS NULL;--> statement-breakpoint

UPDATE "auto_llm_messages"
SET "subject_id" = COALESCE(
  (SELECT (value->>'agent_subject_id')::bigint FROM habitat_runtime_config WHERE section = 'worlds'),
  (SELECT id FROM entities WHERE type = 'agent' ORDER BY id ASC LIMIT 1)
)
WHERE "subject_id" IS NULL;--> statement-breakpoint

UPDATE "cron_jobs"
SET "subject_id" = COALESCE(
  (SELECT (value->>'agent_subject_id')::bigint FROM habitat_runtime_config WHERE section = 'worlds'),
  (SELECT id FROM entities WHERE type = 'agent' ORDER BY id ASC LIMIT 1)
)
WHERE "subject_id" IS NULL;--> statement-breakpoint

UPDATE "search_documents" sd
SET
  "subject_id" = COALESCE(
    (w.body->>'owner_subject_id')::bigint,
    (SELECT (value->>'agent_subject_id')::bigint FROM habitat_runtime_config WHERE section = 'worlds'),
    (SELECT id FROM entities WHERE type = 'agent' ORDER BY id ASC LIMIT 1)
  ),
  "world_id" = COALESCE(sd."world_id", e."world_id")
FROM "entities" e
LEFT JOIN "entities" w ON w.id = e.world_id AND w.type = 'world'
WHERE sd.resource = 'entity'
  AND sd.source_id ~ '^[0-9]+$'
  AND e.id = sd.source_id::bigint
  AND (sd."subject_id" IS NULL OR sd."world_id" IS NULL);--> statement-breakpoint

UPDATE "search_documents" sd
SET
  "subject_id" = m."subject_id",
  "world_id" = COALESCE(
    sd."world_id",
    (subj.body->>'default_private_world_id')::bigint
  )
FROM "messages" m
JOIN "entities" subj ON subj.id = m."subject_id"
WHERE sd.resource = 'message'
  AND sd.source_id = m.id
  AND (sd."subject_id" IS NULL OR sd."world_id" IS NULL);--> statement-breakpoint

UPDATE "search_documents"
SET "subject_id" = COALESCE(
  (SELECT (value->>'agent_subject_id')::bigint FROM habitat_runtime_config WHERE section = 'worlds'),
  (SELECT id FROM entities WHERE type = 'agent' ORDER BY id ASC LIMIT 1)
)
WHERE "subject_id" IS NULL;--> statement-breakpoint

UPDATE "notifications"
SET "recipient_id" = CASE
  WHEN "recipient_kind" = 'user' THEN COALESCE(
    (SELECT (value->>'user_subject_id')::bigint FROM habitat_runtime_config WHERE section = 'worlds'),
    (SELECT id FROM entities WHERE type = 'user' ORDER BY id ASC LIMIT 1)
  )::text
  ELSE COALESCE(
    (SELECT (value->>'agent_subject_id')::bigint FROM habitat_runtime_config WHERE section = 'worlds'),
    (SELECT id FROM entities WHERE type = 'agent' ORDER BY id ASC LIMIT 1)
  )::text
END
WHERE "recipient_id" IS NULL
   OR btrim("recipient_id") = ''
   OR "recipient_id" = 'default'
   OR "recipient_id" !~ '^[0-9]+$';--> statement-breakpoint

ALTER TABLE "notifications" ALTER COLUMN "recipient_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "recipient_id" SET DATA TYPE bigint USING "recipient_id"::bigint;--> statement-breakpoint

ALTER TABLE "conversation_read_state" ALTER COLUMN "subject_id" SET DATA TYPE bigint USING "subject_id"::bigint;--> statement-breakpoint

ALTER TABLE "conversations" ALTER COLUMN "agent_subject_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "subject_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_llm_messages" ALTER COLUMN "subject_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "cron_jobs" ALTER COLUMN "subject_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_llm_runs" ALTER COLUMN "subject_id" SET NOT NULL;--> statement-breakpoint

CREATE INDEX "idx_auto_llm_messages_subject_id" ON "auto_llm_messages" ("subject_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_agent_subject_id" ON "conversations" ("agent_subject_id");--> statement-breakpoint
CREATE INDEX "idx_cron_jobs_subject_id" ON "cron_jobs" ("subject_id");--> statement-breakpoint
CREATE INDEX "idx_messages_subject_id" ON "messages" ("subject_id");--> statement-breakpoint
CREATE INDEX "idx_search_documents_subject_id" ON "search_documents" ("subject_id");--> statement-breakpoint
ALTER TABLE "auto_llm_messages" ADD CONSTRAINT "auto_llm_messages_subject_id_entities_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "auto_llm_runs" ADD CONSTRAINT "auto_llm_runs_subject_id_entities_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "conversation_read_state" ADD CONSTRAINT "conversation_read_state_subject_id_entities_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_agent_subject_id_entities_id_fkey" FOREIGN KEY ("agent_subject_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "cron_jobs" ADD CONSTRAINT "cron_jobs_subject_id_entities_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_subject_id_entities_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_entities_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "entities"("id");
