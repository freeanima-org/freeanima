import {
  getToolRegistry,
  getToolRepos,
  getToolSessionId,
  grantExecutableTools,
} from "@freeanima/engine-loop";
import {
  isSessionMeta,
  loadSessionMeta,
  loadToolsIntoSession,
} from "@freeanima/engine-conversation";
import { applySessionToolMaskFilter } from "@freeanima/engine-conversation";
import {
  attachToolReturns,
  listToolsCatalog,
  searchToolsCatalog,
  toolError,
  toolResult,
  type ToolCatalogEntry,
  type ToolSetRegistry,
} from "@freeanima/engine-tool";
import { CAPABILITIES_TOOLS_RETURNS } from "./return-schemas.ts";
import type { SessionMetaMessage } from "@freeanima/engine-conversation";

function catalogEntryWithAllowed(
  entries: ToolCatalogEntry[],
  meta: SessionMetaMessage,
): Array<ToolCatalogEntry & { allowed: boolean }> {
  const names = entries.map((e) => e.name);
  const allowedSet = new Set(applySessionToolMaskFilter(names, meta));
  return entries.map((entry) => ({
    ...entry,
    allowed: allowedSet.has(entry.name),
  }));
}

async function requireSessionMeta(): Promise<
  { ok: true; meta: SessionMetaMessage } | { ok: false; error: string }
> {
  const sessionId = getToolSessionId();
  const repos = getToolRepos();
  if (!sessionId) return { ok: false, error: "无 session 上下文" };
  if (!repos) return { ok: false, error: "无 repos 上下文" };
  const meta = await loadSessionMeta(repos, sessionId);
  if (!isSessionMeta(meta)) return { ok: false, error: "session 不存在" };
  return { ok: true, meta };
}

export function registerCatalogTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "tools",
    "工具发现与按需加载",
    attachToolReturns(
      [
        {
          name: "tools_list",
          description:
            "列出或搜索工具注册中心中的可用工具（索引，不含 parameters）。可选 query 按名称/描述/ToolSet 过滤；无 query 时分页浏览。加载完整 schema 请用 tools_load。",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "可选：搜索关键词" },
              toolset: { type: "string", description: "可选：限定 ToolSet 名称" },
              offset: { type: "number", description: "无 query 时偏移，默认 0" },
              limit: {
                type: "number",
                description: "每页/最多条数，默认 30（有 query 时默认 20）",
              },
            },
          },
          handler: async (args) => {
            const ctx = await requireSessionMeta();
            if (!ctx.ok) return toolError(ctx.error);
            const registry = getToolRegistry();
            const query = String(args.query ?? "").trim();
            const toolset = args.toolset != null ? String(args.toolset) : undefined;

            if (query) {
              const limit = args.limit != null ? Number(args.limit) : 20;
              const result = searchToolsCatalog(registry, query, {
                toolset,
                limit: Number.isFinite(limit) ? limit : 20,
              });
              return toolResult({
                ...result,
                tools: catalogEntryWithAllowed(result.tools, ctx.meta),
              });
            }

            const offset = args.offset != null ? Number(args.offset) : 0;
            const limit = args.limit != null ? Number(args.limit) : 30;
            const result = listToolsCatalog(registry, {
              toolset,
              offset: Number.isFinite(offset) ? offset : 0,
              limit: Number.isFinite(limit) ? limit : 30,
            });
            return toolResult({
              tools: catalogEntryWithAllowed(result.tools, ctx.meta),
              total: result.total,
            });
          },
        },
        {
          name: "tools_load",
          description:
            "加载一个或多个工具的完整 schema 到当前对话（通过 tool 消息返回 name/description/parameters，不扩展 LLM tools 参数）。支持工具名或 @ToolSet。",
          parameters: {
            type: "object",
            properties: {
              names: {
                type: "array",
                items: { type: "string" },
                description: "工具名或 @ToolSet（如 file_read_file、@file）",
              },
            },
            required: ["names"],
          },
          handler: async (args) => {
            const ctx = await requireSessionMeta();
            if (!ctx.ok) return toolError(ctx.error);
            const raw = args.names;
            if (!Array.isArray(raw) || raw.length === 0) {
              return toolError("names 须为非空数组");
            }
            const names = raw.map((n) => String(n ?? "").trim()).filter(Boolean);
            if (!names.length) return toolError("names 须为非空数组");
            const sessionId = getToolSessionId()!;
            const repos = getToolRepos()!;
            const registry = getToolRegistry();
            const result = await loadToolsIntoSession(repos, registry, sessionId, names, ctx.meta);
            grantExecutableTools([...result.loaded, ...result.already_loaded]);
            return toolResult(result);
          },
        },
      ],
      CAPABILITIES_TOOLS_RETURNS,
    ),
  );
}
