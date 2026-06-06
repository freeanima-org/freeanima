import { registerTool } from "@freeanima/engine-tool";
import type { MessageFtsHit } from "@freeanima/engine-repos";
import { searchL2 } from "./search.ts";
import { indexL3Fact, removeL3Fact } from "./l3-indexer.ts";
import type { SearchResult } from "./search.ts";
import { searchL3 } from "./search.ts";
import { getStore } from "./store.ts";

function asFloat(value: unknown, defaultVal: number): number {
  if (value === null || value === undefined) return defaultVal;
  const n = Number(value);
  return Number.isNaN(n) ? defaultVal : n;
}

function parseCsv(value: string): string[] {
  if (!value.trim()) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatL3Section(results: SearchResult[]): string | null {
  if (!results.length) return null;
  const lines = [`找到 ${results.length} 条匹配事实：`];
  for (const r of results) {
    const meta = r.metadata;
    const id = meta.id ?? "?";
    const conf = Number(meta.confidence ?? 0);
    const imp = Number(meta.importance ?? 0);
    const rec = Number(meta.recall ?? 0);
    lines.push(
      `  [${id}] (${Math.round(conf * 100)}%/ ${Math.round(imp * 100)}%/ ${Math.round(rec * 100)}%) ${r.content}`,
    );
    const domains = meta.domains as string[] | undefined;
    if (domains?.length) {
      lines.push(`       领域: ${domains.join(", ")}`);
    }
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
  registerTool({
    name: "remember",
    description:
      "管理持久化记忆（L3 事实）：创建、更新或删除。\n" +
      "- 默认 action=create：新增一条事实，写入 L3 持久化记忆\n" +
      "- action=update：根据 fact_id 更新已有事实的内容、置信度等\n" +
      "- action=delete：根据 fact_id 删除指定事实\n" +
      "后续对话中高置信度高重要度的事实会自动出现在上下文中。",
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
          description: "事实内容（一句话精炼描述），create 和 update 时必需",
        },
        fact_id: { type: "string", description: "事实 ID，update 或 delete 时必需" },
        domains: { type: "string", description: "逗号分隔的领域标签" },
        entities: { type: "string", description: "逗号分隔的关联实体" },
        confidence: { type: "number", description: "置信度 0-1" },
        importance: { type: "number", description: "重要度 0-1" },
        recall: { type: "number", description: "召回率 0-1" },
      },
      required: [],
    },
    handler: async (args) => {
      const action = String(args.action ?? "create").trim() || "create";

      if (action === "delete") {
        const factId = String(args.fact_id ?? "").trim();
        if (!factId) return JSON.stringify({ error: "fact_id is required for delete" });
        const store = getStore();
        const deleted = store.delete(factId);
        try {
          removeL3Fact(factId);
        } catch {
          /* best-effort */
        }
        return JSON.stringify({ ok: deleted, fact_id: factId, action: "delete" });
      }

      if (action === "update") {
        const factId = String(args.fact_id ?? "").trim();
        if (!factId) return JSON.stringify({ error: "fact_id is required for update" });
        const store = getStore();
        const existing = store.get(factId);
        if (!existing) return JSON.stringify({ error: `Fact not found: ${factId}` });
        const content = String(args.content ?? existing.content).trim();
        if (!content) return JSON.stringify({ error: "content is required for update" });
        const updated = {
          ...existing,
          content,
          confidence:
            args.confidence !== undefined
              ? Math.min(Math.max(asFloat(args.confidence, existing.confidence), 0), 1)
              : existing.confidence,
          importance:
            args.importance !== undefined
              ? Math.min(Math.max(asFloat(args.importance, existing.importance), 0), 1)
              : existing.importance,
          recall:
            args.recall !== undefined
              ? Math.min(Math.max(asFloat(args.recall, existing.recall), 0), 1)
              : existing.recall,
          domains: args.domains !== undefined ? parseCsv(String(args.domains)) : existing.domains,
          entities:
            args.entities !== undefined ? parseCsv(String(args.entities)) : existing.entities,
        };
        store.update(updated);
        try {
          const fact = store.get(factId);
          if (fact) indexL3Fact(fact);
        } catch {
          /* best-effort */
        }
        return JSON.stringify({ ok: true, fact_id: factId, action: "update" });
      }

      const content = String(args.content ?? "").trim();
      if (!content) return JSON.stringify({ error: "content is required" });
      const store = getStore();
      const fid = store.create({
        content,
        confidence: Math.min(Math.max(asFloat(args.confidence, 0.6), 0), 1),
        importance: Math.min(Math.max(asFloat(args.importance, 0.5), 0), 1),
        recall: Math.min(Math.max(asFloat(args.recall, 0.3), 0), 1),
        domains: parseCsv(String(args.domains ?? "")),
        entities: parseCsv(String(args.entities ?? "")),
      });
      try {
        const fact = store.get(fid);
        if (fact) indexL3Fact(fact);
      } catch {
        /* best-effort */
      }
      return fid;
    },
  });

  registerTool({
    name: "recall",
    description:
      '搜索记忆：L3 持久化事实（SQLite FTS）+ 历史对话（PostgreSQL 全文索引，user/assistant 消息）。一次调用返回两处结果。\n\nPG 对话检索语法（to_tsquery simple）：\n- **空格**分隔的词默认 **OR**（任一匹配即可）\n- **AND** 显式指定与：`Free AND Anima`（转为 &）\n- **OR** 显式指定或：`Free OR Anima`（转为 |）\n- **NOT** 排除：`Free NOT Anima`（转为 !）\n- **双引号** 短语：`"逸灵风"`（CJK 按字 OR 匹配）\n\n示例：`Free Anima 重命名`（任一出现即可）',
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "搜索关键词。PG simple 配置：空格=OR；显式 AND/OR/NOT；双引号短语。示例：'Free Anima'（任一匹配）、'Free AND Anima'（同时匹配）、'\"逸灵风\"'（短语）",
        },
        limit: { type: "number", description: "L3 事实最多返回条数，默认 5" },
        session_limit: { type: "number", description: "L2 历史对话最多返回条数，默认 10" },
        session: {
          type: "string",
          description: "可选：仅在指定 session id 内搜索 L2 对话",
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

      const l3Results = searchL3(query, l3Limit);
      const l2Rows = await searchL2(query, { limit: l2Limit, sessionId });

      const sections: string[] = [];
      const l3Text = formatL3Section(l3Results);
      if (l3Text) sections.push(`## L3 事实\n${l3Text}`);
      const l2Text = formatL2Section(l2Rows);
      if (l2Text) sections.push(`## 历史对话\n${l2Text}`);

      if (!sections.length) {
        return `未找到与「${query}」匹配的事实或历史对话。`;
      }
      return sections.join("\n\n");
    },
  });
}
