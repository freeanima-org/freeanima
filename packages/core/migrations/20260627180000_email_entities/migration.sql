CREATE UNIQUE INDEX IF NOT EXISTS "idx_entities_email_message_imap"
ON "entities" (
  (body->>'account_id'),
  (body->>'imap_uid'),
  (body->>'imap_mailbox')
)
WHERE primary_component = 'email_message' AND body->>'imap_uid' IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_entities_email_thread_key"
ON "entities" (
  (body->>'account_id'),
  (body->>'thread_key')
)
WHERE primary_component = 'email_thread';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_entities_email_message_account_sent"
ON "entities" ((body->>'account_id'), (body->>'sent_at') DESC)
WHERE primary_component = 'email_message';
