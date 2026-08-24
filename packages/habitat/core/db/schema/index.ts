import { defineRelations } from "drizzle-orm";

export * from "./columns/pg-timestamptz.ts";
export * from "./embedding.ts";
export * from "./jsonb/index.ts";
export * from "./rows/index.ts";
export * from "./conversations.ts";
export * from "./conversation-read-state.ts";
export * from "./messages.ts";
export * from "./rooms.ts";
export * from "./search-documents.ts";
export * from "./semantic-memory.ts";
export * from "./memory-reference.ts";
export * from "./self-layer.ts";
export * from "./notifications.ts";
export * from "./cron-jobs.ts";
export * from "./cron-log.ts";
export * from "./pipeline-step-run.ts";
export * from "./auto-llm-runs.ts";
export * from "./auto-llm-messages.ts";
export * from "./outpost-instances.ts";
export * from "./federation.ts";
export * from "./service-api-tokens.ts";
export * from "./habitat-runtime-config.ts";
export * from "./entity/index.ts";
export * from "./zod-schemas.ts";

import { conversations } from "./conversations.ts";
import { messages } from "./messages.ts";
import { autoLlmRuns } from "./auto-llm-runs.ts";
import { autoLlmMessages } from "./auto-llm-messages.ts";

/** Drizzle 1.0: relations required config for drizzle() */
export const relations = defineRelations(
  { conversations, messages, autoLlmRuns, autoLlmMessages },
  (r) => ({
    conversations: {
      messages: r.many.messages({
        from: r.conversations.id,
        to: r.messages.conversation_id,
      }),
    },
    messages: {
      conversation: r.one.conversations({
        from: r.messages.conversation_id,
        to: r.conversations.id,
      }),
    },
    autoLlmRuns: {
      messages: r.many.autoLlmMessages({
        from: r.autoLlmRuns.id,
        to: r.autoLlmMessages.run_id,
      }),
    },
    autoLlmMessages: {
      run: r.one.autoLlmRuns({
        from: r.autoLlmMessages.run_id,
        to: r.autoLlmRuns.id,
      }),
    },
  }),
);

export type DbRelations = typeof relations;
