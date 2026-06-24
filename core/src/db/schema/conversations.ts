import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import type { PlatformInfo } from "./jsonb/platform-info.ts";
import type {
  AcpTasksJson,
  AwaitingClarifyJson,
  CompressionJson,
  ConversationCachedToolsetsJson,
  ConversationFunctionsJson,
  ConversationGoalJson,
  ConversationStagedToolsetsJson,
  ConversationTodosJson,
} from "./jsonb/conversation-jsonb.ts";

export const conversations = pgTable("conversations", {
  id: text("id").primaryKey(),
  model: text("model").notNull(),
  title: text("title"),
  cwd: text("cwd"),
  systemPrompt: text("system_prompt"),
  platformInfo: jsonb("platform_info").$type<PlatformInfo | null>(),
  compression: jsonb("compression").$type<CompressionJson | null>(),
  todos: jsonb("todos").$type<ConversationTodosJson>().notNull().default({ items: [], next_id: 1 }),
  awaitingClarify: jsonb("awaiting_clarify").$type<AwaitingClarifyJson | null>(),
  acpTasks: jsonb("acp_tasks").$type<AcpTasksJson | null>(),
  goal: jsonb("goal").$type<ConversationGoalJson | null>(),
  cachedToolsets: jsonb("cached_toolsets")
    .$type<ConversationCachedToolsetsJson>()
    .notNull()
    .default([]),
  stagedToolsets: jsonb("staged_toolsets")
    .$type<ConversationStagedToolsetsJson>()
    .notNull()
    .default([]),
  functions: jsonb("functions").$type<ConversationFunctionsJson>().notNull().default([]),
  debug: boolean("debug").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
});
