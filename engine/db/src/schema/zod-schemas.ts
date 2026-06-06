import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
import { z } from "zod";

import {
  acpSessionsSchema,
  awaitingClarifySchema,
  compressionJsonSchema,
  messagePayloadSchema,
  platformInfoSchema,
  sessionFunctionsSchema,
  sessionTodoStoreSchema,
  sessionToolsSchema,
} from "./jsonb/index.ts";
import { messages } from "./messages.ts";
import { semanticMemory, semanticMemoryTypeSchema } from "./semantic-memory.ts";
import { sessions } from "./sessions.ts";

const sessionJsonbRefine = {
  platformInfo: platformInfoSchema.nullable(),
  compression: compressionJsonSchema.nullable(),
  todos: sessionTodoStoreSchema,
  awaitingClarify: awaitingClarifySchema.nullable(),
  acpSessions: acpSessionsSchema.nullable(),
  tools: sessionToolsSchema,
  functions: sessionFunctionsSchema,
};

export const sessionSelectSchema = createSelectSchema(sessions, sessionJsonbRefine);
export const sessionInsertSchema = createInsertSchema(sessions, sessionJsonbRefine);

const messageJsonbRefine = {
  payload: messagePayloadSchema,
};

export const messageSelectSchema = createSelectSchema(messages, messageJsonbRefine);
export const messageInsertSchema = createInsertSchema(messages, messageJsonbRefine);

export type SessionSelect = z.infer<typeof sessionSelectSchema>;
export type SessionInsert = z.infer<typeof sessionInsertSchema>;
export type MessageSelect = z.infer<typeof messageSelectSchema>;
export type MessageInsert = z.infer<typeof messageInsertSchema>;

const semanticMemoryRefine = {
  type: semanticMemoryTypeSchema,
};

export const semanticMemorySelectSchema = createSelectSchema(semanticMemory, semanticMemoryRefine);
export const semanticMemoryInsertSchema = createInsertSchema(semanticMemory, semanticMemoryRefine);

export type SemanticMemorySelect = z.infer<typeof semanticMemorySelectSchema>;
export type SemanticMemoryInsert = z.infer<typeof semanticMemoryInsertSchema>;
