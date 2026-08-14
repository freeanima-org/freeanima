import { boolean, index, jsonb, pgTable, text } from "drizzle-orm/pg-core";

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
import type { TemporalDayJson } from "./jsonb/temporal-day.ts";

export const conversations = pgTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    model: text("model").notNull(),
    title: text("title"),
    cwd: text("cwd"),
    system_prompt: text("system_prompt"),
    /** CST 02:00 日界刷新用：上次全量构建 system_prompt 的时刻 */
    system_prompt_built_at: pgTimestamptz("system_prompt_built_at"),
    platform_info: jsonb("platform_info").$type<PlatformInfo | null>(),
    /**
     * 情景行为档（与 platform_info 通道身份正交）。
     * `digital_human` | `coding_agent`；NULL = digital_human（兼容旧行）。
     */
    scenario: text("scenario"),
    compression: jsonb("compression").$type<CompressionJson | null>(),
    /** 当天对话级时间摘要 chunks（操作态，不可引用） */
    temporal_day: jsonb("temporal_day").$type<TemporalDayJson | null>(),
    todos: jsonb("todos")
      .$type<ConversationTodosJson>()
      .notNull()
      .default({ items: [], next_id: 1 }),
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
  },
  (t) => [
    index("idx_conversations_updated_at").on(t.updated_at.desc()),
    index("idx_conversations_archived_updated").on(t.archived_at, t.updated_at.desc()),
    // platform_info->>'platform' 表达式索引：见 migrations 追加 SQL
  ],
);
