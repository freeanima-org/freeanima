import { boolean, jsonb, pgTable, text } from "drizzle-orm/pg-core";

import { pgTimestamptz } from "./columns/pg-timestamptz.ts";

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
  system_prompt: text("system_prompt"),
  /** CST 02:00 日界刷新用：上次全量构建 system_prompt 的时刻 */
  system_prompt_built_at: pgTimestamptz("system_prompt_built_at"),
  platform_info: jsonb("platform_info").$type<PlatformInfo | null>(),
  compression: jsonb("compression").$type<CompressionJson | null>(),
  todos: jsonb("todos").$type<ConversationTodosJson>().notNull().default({ items: [], next_id: 1 }),
  awaiting_clarify: jsonb("awaiting_clarify").$type<AwaitingClarifyJson | null>(),
  acp_tasks: jsonb("acp_tasks").$type<AcpTasksJson | null>(),
  goal: jsonb("goal").$type<ConversationGoalJson | null>(),
  cached_toolsets: jsonb("cached_toolsets")
    .$type<ConversationCachedToolsetsJson>()
    .notNull()
    .default([]),
  staged_toolsets: jsonb("staged_toolsets")
    .$type<ConversationStagedToolsetsJson>()
    .notNull()
    .default([]),
  functions: jsonb("functions").$type<ConversationFunctionsJson>().notNull().default([]),
  debug: boolean("debug").notNull().default(false),
  archived_at: pgTimestamptz("archived_at"),
  created_at: pgTimestamptz("created_at").notNull(),
  updated_at: pgTimestamptz("updated_at").notNull(),
});
