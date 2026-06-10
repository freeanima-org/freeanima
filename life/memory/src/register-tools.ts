import type { ToolSetRegistry } from "@freeanima/engine-tool";
import { attachToolReturns, toolError, toolResult } from "@freeanima/engine-tool";
import { MEMORY_TOOL_RETURNS } from "./return-schemas.ts";
import { semanticMemoryToolDefs, rememberFromArgs } from "./semantic-memory-tools.ts";
import { autobiographicalMemoryToolDefs } from "./autobiographical-tools.ts";
import { limbicMemoryToolDefs } from "./limbic-tools.ts";
import { memoryRecallSearch } from "./recall-search.ts";

function asFloat(value: unknown, defaultVal: number): number {
  if (value === null || value === undefined) return defaultVal;
  const n = Number(value);
  return Number.isNaN(n) ? defaultVal : n;
}

const FTS_SYNTAX =
  "PG 检索语法（to_tsquery simple）：\n" +
  "- **空格**分隔的词默认 **AND**（均需匹配）\n" +
  "- **OR** 显式宽召回：`偏好 OR 简洁`（转为 |）\n" +
  "- **AND** / **NOT**：`Free AND Anima`、`Free NOT Anima`\n" +
  '- **双引号** 短语 / CJK 词：`"逸灵风"`、`偏好`（CJK 按字 **邻近** 连续匹配）';

export function registerMemoryTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "memory",
    "记忆检索与管理",
    attachToolReturns(
      [
        ...semanticMemoryToolDefs,
        ...autobiographicalMemoryToolDefs,
        ...limbicMemoryToolDefs,
        {
          name: "memory_remember",
          description:
            "管理持久化语义记忆：创建、更新或删除。\n" +
            "- 默认 action=create：新增一条记忆（自动推断 source_sessions / observed_at）\n" +
            "- action=update：根据 semantic_memory_id 更新已有记忆\n" +
            "- action=delete：根据 semantic_memory_id 物理删除\n" +
            "pinned=true 的记忆会优先出现在常驻上下文中。",
          parameters: {
            type: "object",
            properties: {
              action: {
                type: "string",
                description: "操作类型：create（默认）/ update / delete",
                enum: ["create", "update", "delete"],
              },
              content: {
                type: "string",
                description: "记忆内容（一句话精炼描述），create 和 update 时必需",
              },
              semantic_memory_id: {
                type: "string",
                description: "语义记忆 ID，update 或 delete 时必需",
              },
              fact_id: {
                type: "string",
                description: "semantic_memory_id 的兼容别名，update 或 delete 时可用",
              },
              type: {
                type: "string",
                description:
                  "记忆类型：world/experience/opinion/observation/preference/procedural/imprint",
              },
              pinned: { type: "boolean", description: "是否置顶到常驻记忆" },
            },
            required: [],
          },
          handler: rememberFromArgs,
        },
        {
          name: "memory_recall",
          description:
            "统一检索记忆：语义记忆、历史会话消息、感性记忆、自传体记忆。\n" +
            "跨类型重排后返回最相关的前 N 条（默认 10），结果在 results 数组中，用 memory_type 区分类型。\n" +
            "session 类型仅返回匹配 snippet；全文上下文用 sessions_scroll；会话内细搜用 sessions_search。\n" +
            "结构化语义过滤用 memory_semantic_search。\n\n" +
            FTS_SYNTAX,
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description:
                  '搜索关键词。默认空格=AND；宽召回用 OR；CJK 短语邻近匹配。示例："偏好 简洁"、"偏好 OR 简洁"、"逸灵风"',
              },
              limit: { type: "number", description: "最多返回条数，默认 10，上限 20" },
              session: {
                type: "string",
                description: "可选：仅在该 session 内搜索历史会话消息（memory_type=session）",
              },
            },
            required: ["query"],
          },
          handler: async (args) => {
            const query = String(args.query ?? "").trim();
            if (!query) return toolError("query is required");

            const limit = Math.max(1, Math.min(20, asFloat(args.limit, 10)));
            const sessionId = String(args.session ?? "").trim() || undefined;

            const result = await memoryRecallSearch(query, { limit, sessionId });
            return toolResult(result);
          },
        },
      ],
      MEMORY_TOOL_RETURNS,
    ),
  );
}
