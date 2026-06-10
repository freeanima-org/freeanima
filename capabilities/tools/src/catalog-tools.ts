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
  if (!sessionId) return { ok: false, error: "No session context" };
  if (!repos) return { ok: false, error: "No repos context" };
  const meta = await loadSessionMeta(repos, sessionId);
  if (!isSessionMeta(meta)) return { ok: false, error: "Session does not exist" };
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
            "List or search available tools in the registry (index only, no parameters). Optional query filters by name/description/ToolSet; paginate when no query. Use tools_load for full schema.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Optional: search keyword" },
              toolset: { type: "string", description: "Optional: limit to ToolSet name" },
              offset: { type: "number", description: "Offset when no query, default 0" },
              limit: {
                type: "number",
                description: "Page size / max items, default 30 (default 20 when query present)",
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
