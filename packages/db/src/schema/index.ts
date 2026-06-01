import { defineRelations } from "drizzle-orm";

export * from "./jsonb/index.js";
export * from "./sessions.js";
export * from "./messages.js";
export * from "./zod-schemas.js";

import { messages } from "./messages.js";
import { sessions } from "./sessions.js";

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
