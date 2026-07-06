import { defineRelations } from "drizzle-orm";

export * from "./columns/pg-timestamptz.ts";
export * from "./embedding.ts";
export * from "./jsonb/index.ts";
export * from "./rows/index.ts";
export * from "./conversations.ts";
export * from "./messages.ts";
export * from "./semantic-memory.ts";
export * from "./memory-reference.ts";
export * from "./self-layer.ts";
export * from "./autobiographical-memory.ts";
export * from "./limbic-memory.ts";
export * from "./notifications.ts";
export * from "./cron-jobs.ts";
export * from "./cron-log.ts";
export * from "./pipeline-step-run.ts";
export * from "./auto-llm-runs.ts";
export * from "./sap-instances.ts";
export * from "./service-api-tokens.ts";
export * from "./entity/index.ts";
export * from "./zod-schemas.ts";

import { conversations } from "./conversations.ts";
import { messages } from "./messages.ts";
import { semanticMemory } from "./semantic-memory.ts";

/** Drizzle 1.0: relations required config for drizzle() */
export const relations = defineRelations({ conversations, messages, semanticMemory }, (r) => ({
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
}));

export type DbRelations = typeof relations;
