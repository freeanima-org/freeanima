CREATE TABLE "conversation_read_state" (
	"conversation_id" text,
	"subject_id" text,
	"last_read_pos" bigint DEFAULT 0 NOT NULL,
	"read_at" timestamp with time zone NOT NULL,
	CONSTRAINT "conversation_read_state_pkey" PRIMARY KEY("conversation_id","subject_id")
);
--> statement-breakpoint
CREATE INDEX "idx_conversation_read_state_subject" ON "conversation_read_state" ("subject_id");--> statement-breakpoint
ALTER TABLE "conversation_read_state" ADD CONSTRAINT "conversation_read_state_conversation_id_conversations_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE;
--> statement-breakpoint
-- 上线时把现有会话标为已读（用户 subject = entities.type='user' 最小 id），避免历史会话全变未读
INSERT INTO "conversation_read_state" ("conversation_id", "subject_id", "last_read_pos", "read_at")
SELECT
  c.id,
  u.subject_id,
  COALESCE((SELECT MAX(m.pos) FROM messages m WHERE m.conversation_id = c.id), 0),
  now()
FROM conversations c
CROSS JOIN (
  SELECT id::text AS subject_id
  FROM entities
  WHERE type = 'user'
  ORDER BY id ASC
  LIMIT 1
) u
ON CONFLICT DO NOTHING;