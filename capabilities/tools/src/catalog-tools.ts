import {
  getToolRegistry,
  getToolRepos,
  getToolSessionId,
  grantExecutableTools,
} from "@freeanima/mechanism-tool";
import { isSessionMeta, type SessionMetaMessage } from "@freeanima/storage-db/domain";
import {
  applySessionToolMaskFilter,
  attachToolReturns,
  listToolsCatalog,
  loadToolsIntoSession,
  searchToolsCatalog,
  toolError,
  toolResult,
  type ToolCatalogEntry,
  type ToolSetRegistry,
} from "@freeanima/mechanism-tool";
import { CAPABILITIES_TOOLS_RETURNS } from "./return-schemas.ts";

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
  if (!sessionId) return { ok: false, error: "No session context" };
  if (!repos) return { ok: false, error: "No repos context" };
  const raw = await repos.session.getSessionMeta(sessionId);
  if (!raw || !isSessionMeta(raw)) return { ok: false, error: "Session does not exist" };
  const meta = raw;
  return { ok: true, meta };
}

export function registerCatalogTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "tools",
    "Tool discovery and on-demand loading",
    attachToolReturns(
      [
        {
          name: "tools_list",
          description:
            "List tool names in the registry (index only). System prompt already lists ToolSets; use optional toolset and keyword to find concrete tool names, then tools_load for full schema.",
          parameters: {
            type: "object",
            properties: {
              toolset: { type: "string", description: "Optional: limit to ToolSet name" },
              keyword: { type: "string", description: "Optional: search tool name/description" },
            },
          },
          handler: async (args) => {
            const ctx = await requireSessionMeta();
            if (!ctx.ok) return toolError(ctx.error);
            const registry = getToolRegistry();
            const keyword = String(args.keyword ?? "").trim();
            const toolset = args.toolset != null ? String(args.toolset).trim() : undefined;

            if (keyword) {
              const result = searchToolsCatalog(registry, keyword, { toolset });
              return toolResult({
                keyword,
                tools: catalogEntryWithAllowed(result.tools, ctx.meta),
                total: result.total,
              });
            }

            const result = listToolsCatalog(registry, { toolset });
            return toolResult({
              tools: catalogEntryWithAllowed(result.tools, ctx.meta),
              total: result.total,
            });
          },
        },
        {
          name: "tools_load",
          description:
            "Load full schema for one or more tools into the current conversation (returns name/description/parameters via tool message, does not expand LLM tool params). Supports tool names or @ToolSet.",
          parameters: {
            type: "object",
            properties: {
              names: {
                type: "array",
                items: { type: "string" },
                description: "Tool name or @ToolSet (e.g. file_read_file, @file)",
              },
            },
            required: ["names"],
          },
          handler: async (args) => {
            const ctx = await requireSessionMeta();
            if (!ctx.ok) return toolError(ctx.error);
            const raw = args.names;
            if (!Array.isArray(raw) || raw.length === 0) {
              return toolError("names must be a non-empty array");
            }
            const names = raw.map((n) => String(n ?? "").trim()).filter(Boolean);
            if (!names.length) return toolError("names must be a non-empty array");
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
