import { defineRelations } from "drizzle-orm";

export * from "./embedding.ts";
export * from "./jsonb/index.ts";
export * from "./sessions.ts";
export * from "./messages.ts";
export * from "./semantic-memory.ts";
export * from "./memory-reference.ts";
export * from "./self-layer.ts";
export * from "./autobiographical-memory.ts";
export * from "./limbic-memory.ts";
export * from "./tasks.ts";
export * from "./zod-schemas.ts";

import { messages } from "./messages.ts";
import { semanticMemory } from "./semantic-memory.ts";
import { sessions } from "./sessions.ts";

/** Drizzle 1.0：relations 为 drizzle() 必需配置 */
export const relations = defineRelations({ sessions, messages, semanticMemory }, (r) => ({
  sessions: {
    messages: r.many.messages({
      from: r.sessions.id,
      to: r.messages.sessionId,
    }),
  },
  messages: {
    session: r.one.sessions({
      from: r.messages.sessionId,
      to: r.sessions.id,
    }),
  },
}));

export type DbRelations = typeof relations;
