import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import type { PlatformInfo } from "./jsonb/platform-info.ts";
import type {
  AcpSessionsJson,
  AwaitingClarifyJson,
  CompressionJson,
  SessionFunctionsJson,
  SessionLoadedToolsJson,
  SessionTodosJson,
  SessionToolsJson,
} from "./jsonb/session-jsonb.ts";

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  model: text("model").notNull(),
  title: text("title"),
  cwd: text("cwd"),
  systemPrompt: text("system_prompt"),
  platformInfo: jsonb("platform_info").$type<PlatformInfo | null>(),
  compression: jsonb("compression").$type<CompressionJson | null>(),
  todos: jsonb("todos").$type<SessionTodosJson>().notNull().default({ items: [], next_id: 1 }),
  awaitingClarify: jsonb("awaiting_clarify").$type<AwaitingClarifyJson | null>(),
  acpSessions: jsonb("acp_sessions").$type<AcpSessionsJson | null>(),
  tools: jsonb("tools").$type<SessionToolsJson>().notNull().default([]),
  loadedTools: jsonb("loaded_tools").$type<SessionLoadedToolsJson>().notNull().default([]),
  functions: jsonb("functions").$type<SessionFunctionsJson>().notNull().default([]),
  debug: boolean("debug").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
});
