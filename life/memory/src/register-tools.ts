import { registerTool } from "@freeanima/engine-tool";
import type { MessageFtsHit } from "@freeanima/engine-repos";
import { searchL2 } from "./search.ts";
import type { SearchResult } from "./search.ts";
import { searchL3 } from "./search.ts";
import { registerSemanticMemoryTools, rememberFromArgs } from "./semantic-memory-tools.ts";
import { registerAutobiographicalMemoryTools } from "./autobiographical-tools.ts";
import { registerLimbicMemoryTools } from "./limbic-tools.ts";

function asFloat(value: unknown, defaultVal: number): number {
  if (value === null || value === undefined) return defaultVal;
  const n = Number(value);
  return Number.isNaN(n) ? defaultVal : n;
}

function formatL3Section(results: SearchResult[]): string | null {
  if (!results.length) return null;
  const lines = [`找到 ${results.length} 条匹配记忆：`];
  for (const r of results) {
    const meta = r.metadata;
    const id = meta.id ?? "?";
    const type = String(meta.type ?? "world");
    const pinned = meta.pinned ? "📌" : "";
    lines.push(`  [${id}] (${type})${pinned} ${r.content}`);
  }
  return lines.join("\n");
}

function formatL2Section(rows: MessageFtsHit[]): string | null {
  if (!rows.length) return null;
  const lines = [`找到 ${rows.length} 条匹配对话：`];
  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx]!;
    const sid = r.session_id.slice(0, 16);
    const ts = r.timestamp.slice(0, 19) || "?";
    const content = r.content.slice(0, 400);
    lines.push(`\n--- ${idx + 1}. [${sid}] ${r.role} (${ts}) ---`);
    lines.push(`  → ${content.slice(0, 200)}${content.length > 200 ? "…" : ""}`);
  }
  return lines.join("\n");
}

export function registerMemoryTools(): void {
  registerSemanticMemoryTools();
  registerAutobiographicalMemoryTools();
  registerLimbicMemoryTools();

  registerTool({
    name: "remember",
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
  });

  registerTool({
    name: "recall",
    description:
      '搜索记忆：语义记忆（PostgreSQL 全文索引）+ 历史对话（PostgreSQL messages 全文索引）。一次调用返回两处结果。\n\nPG 对话检索语法（to_tsquery simple）：\n- **空格**分隔的词默认 **OR**（任一匹配即可）\n- **AND** 显式指定与：`Free AND Anima`（转为 &）\n- **OR** 显式指定或：`Free OR Anima`（转为 |）\n- **NOT** 排除：`Free NOT Anima`（转为 !）\n- **双引号** 短语：`"逸灵风"`（CJK 按字 OR 匹配）\n\n示例：`Free Anima 重命名`（任一出现即可）',
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "搜索关键词。PG simple 配置：空格=OR；显式 AND/OR/NOT；双引号短语。示例：'Free Anima'（任一匹配）、'Free AND Anima'（同时匹配）、'\"逸灵风\"'（短语）",
        },
        limit: { type: "number", description: "语义记忆最多返回条数，默认 5" },
        session_limit: { type: "number", description: "历史对话最多返回条数，默认 10" },
        session: {
          type: "string",
          description: "可选：仅在指定 session id 内搜索历史对话",
        },
      },
      required: ["query"],
    },
    handler: async (args) => {
      const query = String(args.query ?? "").trim();
      if (!query) return JSON.stringify({ error: "query is required" });

      const l3Limit = Math.max(1, Math.min(50, asFloat(args.limit, 5)));
      const l2Limit = Math.max(1, Math.min(50, asFloat(args.session_limit, 10)));
      const sessionId = String(args.session ?? "").trim() || undefined;

      const l3Results = await searchL3(query, l3Limit);
      const l2Rows = await searchL2(query, { limit: l2Limit, sessionId });

      const sections: string[] = [];
      const l3Text = formatL3Section(l3Results);
      if (l3Text) sections.push(`## 语义记忆\n${l3Text}`);
      const l2Text = formatL2Section(l2Rows);
      if (l2Text) sections.push(`## 历史对话\n${l2Text}`);

      if (!sections.length) {
        return `未找到与「${query}」匹配的记忆或历史对话。`;
      }
      return sections.join("\n\n");
    },
  });
}
