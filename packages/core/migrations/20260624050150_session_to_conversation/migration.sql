ALTER TABLE "sessions" RENAME TO "conversations";--> statement-breakpoint
ALTER TABLE "messages" RENAME COLUMN "session_id" TO "conversation_id";--> statement-breakpoint
ALTER TABLE "semantic_memory" RENAME COLUMN "source_sessions" TO "source_conversations";--> statement-breakpoint
ALTER TABLE "memory_references" RENAME COLUMN "session_id" TO "conversation_id";--> statement-breakpoint
ALTER TABLE "autobiographical_memory" RENAME COLUMN "source_sessions" TO "source_conversations";--> statement-breakpoint
ALTER TABLE "limbic_memory" RENAME COLUMN "session_id" TO "conversation_id";--> statement-breakpoint
ALTER TABLE "dream_memory" RENAME COLUMN "source_session_ids" TO "source_conversation_ids";--> statement-breakpoint
ALTER TABLE "tasks" RENAME COLUMN "source_session_id" TO "source_conversation_id";--> statement-breakpoint
ALTER INDEX "messages_session_id_pos_uidx" RENAME TO "messages_conversation_id_pos_uidx";--> statement-breakpoint
ALTER INDEX "idx_semantic_memory_source_sessions" RENAME TO "idx_semantic_memory_source_conversations";--> statement-breakpoint
ALTER INDEX "idx_memory_references_session_id" RENAME TO "idx_memory_references_conversation_id";--> statement-breakpoint
ALTER INDEX "idx_autobiographical_memory_source_sessions" RENAME TO "idx_autobiographical_memory_source_conversations";--> statement-breakpoint
ALTER INDEX "idx_limbic_memory_session_id" RENAME TO "idx_limbic_memory_conversation_id";--> statement-breakpoint
ALTER INDEX "sessions_pkey" RENAME TO "conversations_pkey";--> statement-breakpoint
ALTER TABLE "messages" RENAME CONSTRAINT "messages_session_id_sessions_id_fkey" TO "messages_conversation_id_conversations_id_fkey";--> statement-breakpoint
ALTER TABLE "memory_references" RENAME CONSTRAINT "memory_references_session_id_sessions_id_fkey" TO "memory_references_conversation_id_conversations_id_fkey";--> statement-breakpoint
ALTER TABLE "tasks" RENAME CONSTRAINT "tasks_source_session_id_sessions_id_fk" TO "tasks_source_conversation_id_conversations_id_fk";--> statement-breakpoint
UPDATE "messages"
SET payload = jsonb_set(payload, '{role}', '"conversation_meta"')
WHERE payload->>'role' = 'session_meta';--> statement-breakpoint
UPDATE "limbic_memory" SET kind = 'conversation_mood' WHERE kind = 'session_mood';