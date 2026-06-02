import { z } from "zod";

import {
  awaitingClarifySchema,
  compressionStateSchema,
  openAiToolSchema,
  sessionTodoStoreSchema,
} from "@freeanima/legacy-kernel";

/** sessions.compression */
export type CompressionJson = z.infer<typeof compressionStateSchema>;

/** sessions.todos */
export type SessionTodosJson = z.infer<typeof sessionTodoStoreSchema>;

/** sessions.awaiting_clarify */
export type AwaitingClarifyJson = z.infer<typeof awaitingClarifySchema>;

/** sessions.acp_sessions */
export const acpSessionsSchema = z.record(z.string(), z.string());
export type AcpSessionsJson = z.infer<typeof acpSessionsSchema>;

/** sessions.tools */
export const sessionToolsSchema = z.array(openAiToolSchema);
export type SessionToolsJson = z.infer<typeof sessionToolsSchema>;

/** sessions.functions */
export const sessionFunctionsSchema = z.array(z.string());
export type SessionFunctionsJson = z.infer<typeof sessionFunctionsSchema>;

export {
  awaitingClarifySchema,
  compressionStateSchema,
  openAiToolSchema,
  sessionTodoStoreSchema,
};
