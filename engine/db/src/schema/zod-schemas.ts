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
import {
  autobiographicalMemory,
  autobiographicalSignificanceSchema,
  autobiographicalStatusSchema,
} from "./autobiographical-memory.ts";
import { messages } from "./messages.ts";
import { semanticMemory, semanticMemoryTypeSchema } from "./semantic-memory.ts";
import { selfBlockKeySchema, selfBlocks } from "./self-layer.ts";
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

const selfBlocksRefine = {
  blockKey: selfBlockKeySchema,
};

export const selfBlocksSelectSchema = createSelectSchema(selfBlocks, selfBlocksRefine);
export const selfBlocksInsertSchema = createInsertSchema(selfBlocks, selfBlocksRefine);

export type SelfBlocksSelect = z.infer<typeof selfBlocksSelectSchema>;
export type SelfBlocksInsert = z.infer<typeof selfBlocksInsertSchema>;

const autobiographicalMemoryRefine = {
  significance: autobiographicalSignificanceSchema,
  status: autobiographicalStatusSchema,
};

export const autobiographicalMemorySelectSchema = createSelectSchema(
  autobiographicalMemory,
  autobiographicalMemoryRefine,
);
export const autobiographicalMemoryInsertSchema = createInsertSchema(
  autobiographicalMemory,
  autobiographicalMemoryRefine,
);

export type AutobiographicalMemorySelect = z.infer<typeof autobiographicalMemorySelectSchema>;
export type AutobiographicalMemoryInsert = z.infer<typeof autobiographicalMemoryInsertSchema>;
