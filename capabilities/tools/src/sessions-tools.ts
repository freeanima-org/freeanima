import { getToolRepos } from "@freeanima/engine-loop";
import { toolError, toolResult, type ToolSetRegistry } from "@freeanima/engine-tool";
import { formatSessionMessageSearchHit } from "@freeanima/kernel-util";

const FTS_SYNTAX =
  "PG 检索语法（to_tsquery simple）：\n" +
  "- **空格**分隔的词默认 **AND**（均需匹配）\n" +
  "- **OR** 显式宽召回：`偏好 OR 简洁`（转为 |）\n" +
  "- **AND** / **NOT**：`Free AND Anima`、`Free NOT Anima`\n" +
  '- **双引号** 短语 / CJK 词：`"逸灵风"`、`偏好`（CJK 按字 **邻近** 连续匹配）';

function asInt(value: unknown, defaultVal: number, min: number, max: number): number {
  if (value === null || value === undefined) return defaultVal;
  const n = Number(value);
  if (!Number.isFinite(n)) return defaultVal;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function requireSessionStore():
  | { ok: true; store: NonNullable<ReturnType<typeof getToolRepos>>["session"] }
  | { ok: false; error: string } {
  const repos = getToolRepos();
  if (!repos) return { ok: false, error: "无 repos 上下文" };
  return { ok: true, store: repos.session };
}

export function registerSessionTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet("sessions", "历史对话检索与分页阅读", [
    {
      name: "sessions_search",
      description:
        "搜索历史对话（PostgreSQL messages 全文索引）。\n" +
        "返回匹配关键词 snippet，不含整条消息正文；可用 session 限定范围。\n" +
        "加载全文上下文请用 sessions_scroll。\n\n" +
        FTS_SYNTAX,
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "搜索关键词。默认空格=AND；宽召回用 OR",
          },
          session: { type: "string", description: "可选：仅在指定 session id 内搜索" },
          limit: { type: "number", description: "最多返回条数，默认 10" },
        },
        required: ["query"],
      },
      handler: async (args) => {
        const ctx = requireSessionStore();
        if (!ctx.ok) return toolError(ctx.error);

        const query = String(args.query ?? "").trim();
        if (!query) return toolError("query is required");

        const limit = asInt(args.limit, 10, 1, 50);
        const sessionId = String(args.session ?? "").trim() || undefined;
        const rows = await ctx.store.searchMessagesFts(query, { sessionId, limit });
        const hits = rows.map((r) => formatSessionMessageSearchHit(query, r));

        return toolResult({
          query,
          hits,
          summary: hits.length
            ? `找到 ${hits.length} 条历史对话`
            : `未找到与「${query}」匹配的历史对话`,
        });
      },
    },
    {
      name: "sessions_scroll",
      description:
        "分页阅读指定 session 的历史消息（user/assistant 完整 content；tool 消息截断）。\n" +
        "可用 message_id（来自 memory_recall 或 sessions_search）作为锚点，从该消息起向后读取；否则用 offset 分页。",
      parameters: {
        type: "object",
        properties: {
          session_id: { type: "string", description: "session id" },
          message_id: {
            type: "string",
            description: "可选：锚点消息 id，优先于 offset",
          },
          offset: { type: "number", description: "分页偏移（按 pos 顺序），默认 0" },
          limit: { type: "number", description: "每页条数，默认 20" },
        },
        required: ["session_id"],
      },
      handler: async (args) => {
        const ctx = requireSessionStore();
        if (!ctx.ok) return toolError(ctx.error);

        const sessionId = String(args.session_id ?? "").trim();
        if (!sessionId) return toolError("session_id is required");
        if (!(await ctx.store.sessionExists(sessionId))) {
          return toolError(`session not found: ${sessionId}`);
        }

        const limit = asInt(args.limit, 20, 1, 100);
        const messageId = String(args.message_id ?? "").trim();
        const total = await ctx.store.countMessages(sessionId);

        let messages;
        let offset: number;
        if (messageId) {
          const pos = await ctx.store.findMessagePos(sessionId, messageId);
          if (pos == null) return toolError(`message not found: ${messageId}`);
          messages = await ctx.store.listMessageRowsFromPos(sessionId, pos, limit);
          offset = Math.max(0, pos - 1);
        } else {
          offset = asInt(args.offset, 0, 0, Number.MAX_SAFE_INTEGER);
          messages = await ctx.store.listMessageRowsPage(sessionId, offset, limit);
        }

        return toolResult({
          session_id: sessionId,
          messages,
          total,
          offset,
          limit,
        });
      },
    },
  ]);
}
