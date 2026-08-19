/**
 * Gen 配置：表 → 列覆盖（对齐今日 createSelectSchema refine）。
 * override.expr 为完整 Zod 表达式；对象覆盖时不再自动套 nullable/optional（同 drizzle-orm/zod）。
 */
export type ColumnOverride = {
  /** 写入生成文件的 Zod 表达式，如 `messagePayloadSchema` 或 `platformInfoSchema.nullable()` */
  expr: string;
  /** 相对生成 rows 文件的 import */
  imports: Array<{ from: string; names: string[] }>;
};

export type TableGenSpec = {
  /** 输出文件名（不含 .gen.ts） */
  fileBase: string;
  /** select/insert 导出前缀，如 message → messageSelectSchema */
  exportPrefix: string;
  /** 从 schema 模块动态 import 的表导出名 */
  tableExport: string;
  /** 相对仓库根的表模块路径 */
  tableModule: string;
  /** 列 JSDoc（运行时元数据无注释时用手写） */
  comments?: Record<string, string>;
  overrides?: Record<string, ColumnOverride>;
};

export const TABLE_SPECS: TableGenSpec[] = [
  {
    fileBase: "messages",
    exportPrefix: "message",
    tableExport: "messages",
    tableModule: "packages/habitat/core/db/schema/messages.ts",
    comments: {
      id: "Globally unique row id (PG PK; compression points to pos, not this column)",
      pos: "Monotonic in-conversation sequence (compression l2/l3 point here; domain Message.pos)",
    },
    overrides: {
      payload: {
        expr: "messagePayloadSchema",
        imports: [{ from: "../jsonb/message-payload.ts", names: ["messagePayloadSchema"] }],
      },
    },
  },
  {
    fileBase: "conversations",
    exportPrefix: "conversation",
    tableExport: "conversations",
    tableModule: "packages/habitat/core/db/schema/conversations.ts",
    comments: {
      system_prompt_built_at: "CST 02:00 日界刷新用：上次全量构建 system_prompt 的时刻",
      scenario:
        "情景行为档（与 platform_info 通道身份正交）。digital_human | coding_agent；NULL = digital_human（兼容旧行）。",
      temporal_day: "当天对话级时间摘要 chunks（操作态，不可引用）",
    },
    overrides: {
      platform_info: {
        expr: "platformInfoSchema.nullable()",
        imports: [{ from: "../jsonb/platform-info.ts", names: ["platformInfoSchema"] }],
      },
      scenario: {
        expr: "conversationScenarioSchema.nullable().optional()",
        imports: [{ from: "../entity/enums.ts", names: ["conversationScenarioSchema"] }],
      },
      compression: {
        expr: "compressionJsonSchema.nullable()",
        imports: [{ from: "../jsonb/compression.ts", names: ["compressionJsonSchema"] }],
      },
      temporal_day: {
        expr: "temporalDayJsonSchema.nullable()",
        imports: [{ from: "../jsonb/temporal-day.ts", names: ["temporalDayJsonSchema"] }],
      },
      todos: {
        expr: "conversationTodoStoreSchema",
        imports: [
          { from: "../jsonb/conversation-meta-jsonb.ts", names: ["conversationTodoStoreSchema"] },
        ],
      },
      awaiting_clarify: {
        expr: "awaitingClarifySchema.nullable()",
        imports: [
          { from: "../jsonb/conversation-meta-jsonb.ts", names: ["awaitingClarifySchema"] },
        ],
      },
      acp_tasks: {
        expr: "acpTasksSchema.nullable()",
        imports: [{ from: "../jsonb/conversation-meta-jsonb.ts", names: ["acpTasksSchema"] }],
      },
      goal: {
        expr: "conversationGoalSchema.nullable()",
        imports: [
          { from: "../jsonb/conversation-meta-jsonb.ts", names: ["conversationGoalSchema"] },
        ],
      },
      cached_toolsets: {
        expr: "conversationCachedToolsetsSchema",
        imports: [
          {
            from: "../jsonb/conversation-meta-jsonb.ts",
            names: ["conversationCachedToolsetsSchema"],
          },
        ],
      },
      staged_toolsets: {
        expr: "conversationStagedToolsetsSchema",
        imports: [
          {
            from: "../jsonb/conversation-meta-jsonb.ts",
            names: ["conversationStagedToolsetsSchema"],
          },
        ],
      },
      functions: {
        expr: "conversationFunctionsSchema",
        imports: [
          { from: "../jsonb/conversation-meta-jsonb.ts", names: ["conversationFunctionsSchema"] },
        ],
      },
      system_prompt_built_at: {
        expr: "z.coerce.date().nullable().optional()",
        imports: [],
      },
      archived_at: {
        expr: "z.coerce.date().nullable().optional()",
        imports: [],
      },
      pinned_at: {
        expr: "z.coerce.date().nullable().optional()",
        imports: [],
      },
      created_at: {
        expr: "z.coerce.date()",
        imports: [],
      },
      updated_at: {
        expr: "z.coerce.date()",
        imports: [],
      },
    },
  },
  {
    fileBase: "self-blocks",
    exportPrefix: "selfBlocks",
    tableExport: "selfBlocks",
    tableModule: "packages/habitat/core/db/schema/self-layer.ts",
    comments: {
      block_key: "Self-layer five blocks (one row per block_key)",
    },
    overrides: {
      block_key: {
        expr: "selfBlockKeySchema",
        imports: [{ from: "../entity/enums.ts", names: ["selfBlockKeySchema"] }],
      },
    },
  },
];
