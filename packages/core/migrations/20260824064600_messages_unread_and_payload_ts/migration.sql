-- messages 热路径：assistant 未读探测 + payload.timestamp range（drizzle-kit --custom）
CREATE OR REPLACE FUNCTION message_payload_timestamp(payload jsonb)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT nullif(btrim(payload->>'timestamp'), '')::timestamptz
$$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_messages_payload_timestamp"
  ON "messages" (message_payload_timestamp(payload));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_messages_conversation_assistant_pos"
  ON "messages" ("conversation_id", "pos")
  WHERE (payload->>'role') = 'assistant';
