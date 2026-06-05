import { defineRelations } from "drizzle-orm";

export * from "./jsonb/index.ts";
export * from "./sessions.ts";
export * from "./messages.ts";
export * from "./zod-schemas.ts";

import { messages } from "./messages.ts";
import { sessions } from "./sessions.ts";

/** Drizzle 1.0：relations 为 drizzle() 必需配置 */
export const relations = defineRelations({ sessions, messages }, (r) => ({
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
