import { bigint, boolean, index, jsonb, pgTable, text } from "drizzle-orm/pg-core";

import { pgTimestamptz } from "./columns/pg-timestamptz.ts";
import { entities } from "./entity/entity.ts";

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
    /** Write-only marker synced from meta; do not use for LLM routing. */
    model: text("model").notNull(),
    title: text("title"),
    cwd: text("cwd"),
    system_prompt: text("system_prompt"),
    /** CST 02:00 日界刷新用：上次全量构建 system_prompt 的时刻 */
    system_prompt_built_at: pgTimestamptz("system_prompt_built_at"),
    platform_info: jsonb("platform_info").$type<PlatformInfo | null>(),
    /**
     * 情景行为档（与 platform_info 通道身份正交）。
     * `digital_human` | `coding_agent` | `room_inner`；NULL = digital_human（兼容旧行）。
     */
    scenario: text("scenario"),
    /** 会话绑定的 agent subject（entities.id）；本机 LLM 运行时解析用 */
    agent_subject_id: bigint("agent_subject_id", { mode: "number" })
      .notNull()
      .references(() => entities.id),
    /**
     * 稳定公开键（subject body.public_id）。Room 席位唯一约束用此列。
     * 与 agent_subject_id 双写；建会话时写入，迁移回填旧行。
     */
    agent_public_id: text("agent_public_id"),
    /** 绑定的群聊 Room；空=私聊 */
    room_id: text("room_id"),
    /** 已投影进内心队列的最大 room_messages.seq */
    last_projected_room_seq: bigint("last_projected_room_seq", { mode: "number" })
      .notNull()
      .default(0),
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
    /** 置顶时间；非空表示已置顶，列表优先排在前面 */
    pinned_at: pgTimestamptz("pinned_at"),
    created_at: pgTimestamptz("created_at").notNull(),
    updated_at: pgTimestamptz("updated_at").notNull(),
  },
  (t) => [
    index("idx_conversations_updated_at").on(t.updated_at.desc()),
    index("idx_conversations_archived_updated").on(t.archived_at, t.updated_at.desc()),
    index("idx_conversations_pinned_updated").on(t.pinned_at, t.updated_at.desc()),
    index("idx_conversations_agent_subject_id").on(t.agent_subject_id),
    index("idx_conversations_agent_public_id").on(t.agent_public_id),
    index("idx_conversations_room_id").on(t.room_id),
    // UNIQUE(room_id, agent_public_id) WHERE room_id IS NOT NULL：见 migration 追加 SQL
    // platform_info->>'platform' 表达式索引：见 migrations 追加 SQL
  ],
);
