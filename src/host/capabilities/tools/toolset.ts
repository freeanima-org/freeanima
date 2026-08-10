import {
  getToolRegistry,
  getToolConversationId,
  getToolContextKind,
  grantExecutableTools,
  revokeExecutableTools,
} from "@freeanima/host/core/tool";
import { isConversationMeta, type ConversationMetaMessage } from "@freeanima/host/core/db/domain";
import { getConversationMeta } from "@freeanima/host/core/db/pg/conversation";
import {
  applyConversationToolMaskFilter,
  attachToolReturns,
  loadToolSetsIntoConversation,
  unloadToolSetsFromConversation,
  searchToolsetsCatalog,
  toolError,
  toolResult,
  toolNamesForToolSets,
  type ToolSetRegistry,
} from "@freeanima/host/core/tool";
import { CAPABILITIES_TOOLS_RETURNS } from "./return-schemas.ts";

async function requireSessionMeta(): Promise<
  { ok: true; meta: ConversationMetaMessage } | { ok: false; error: string }
> {
  const conversationId = getToolConversationId();
  if (!conversationId) return { ok: false, error: "No conversation context" };
  const raw = await getConversationMeta(conversationId);
  if (!raw || !isConversationMeta(raw)) return { ok: false, error: "Session does not exist" };
  const meta = raw;
  return { ok: true, meta };
}

function hitsWithAllowed(
  hits: ReturnType<typeof searchToolsetsCatalog>["hits"],
  meta: ConversationMetaMessage,
) {
  return hits.map((hit) => {
    const toolNames = hit.tools.map((t) => t.name);
    const allowedSet = new Set(applyConversationToolMaskFilter(toolNames, meta));
    const allowed = toolNames.some((n) => allowedSet.has(n));
    return { ...hit, allowed };
  });
}

export function registerToolsetTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "toolset",
    "ToolSet discovery and on-demand loading",
    attachToolReturns(
      [
        {
          name: "toolset_search",
          description:
            "Search dynamically registered ToolSets (MCP/Outpost) by keyword. Built-in ToolSets are listed in system prompt — use toolset_load directly.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Required search query (space-separated terms match AND)",
              },
            },
            required: ["query"],
          },
          handler: async (args) => {
            if (getToolContextKind() === "auto_llm") {
              return toolError("toolset_search is not available in AutoLlm / policy-bound runs");
            }
            const ctx = await requireSessionMeta();
            if (!ctx.ok) return toolError(ctx.error);
            const query = String(args.query ?? "").trim();
            if (!query) return toolError("query is required");
            const registry = getToolRegistry();
            const result = searchToolsetsCatalog(registry, query);
            return toolResult({
              query: result.query,
              hits: hitsWithAllowed(result.hits, ctx.meta),
              total: result.total,
            });
          },
        },
        {
          name: "toolset_load",
          description:
            "Stage ToolSets for the current conversation (returns schemas via tool message). Cached ToolSets are sent in API tools after rebuild_conversation_cache or compression.",
          parameters: {
            type: "object",
            properties: {
              toolsets: {
                type: "array",
                items: { type: "string" },
                description: "ToolSet names to stage (e.g. file, mcp_postgres)",
              },
            },
            required: ["toolsets"],
          },
          handler: async (args) => {
            if (getToolContextKind() === "auto_llm") {
              return toolError("toolset_load is not available in AutoLlm / policy-bound runs");
            }
            const ctx = await requireSessionMeta();
            if (!ctx.ok) return toolError(ctx.error);
            const raw = args.toolsets;
            if (!Array.isArray(raw) || raw.length === 0) {
              return toolError("toolsets must be a non-empty array");
            }
            const toolsets = raw.map((n) => String(n ?? "").trim()).filter(Boolean);
            if (toolsets.length === 0) return toolError("toolsets must be a non-empty array");
            const conversationId = getToolConversationId();
            if (!conversationId) return toolError("conversation_id is required");
            const registry = getToolRegistry();
            const result = await loadToolSetsIntoConversation(
              registry,
              conversationId,
              toolsets,
              ctx.meta,
            );
            const expanded = toolNamesForToolSets(registry, [
              ...result.loaded,
              ...result.already_loaded,
            ]);
            grantExecutableTools(expanded);
            return toolResult(result);
          },
        },
        {
          name: "toolset_unload",
          description:
            "Unload non-default ToolSets from the current conversation (removes from staged and cached). Default ToolSets (toolset, memory, notification, skill, subagent) cannot be unloaded.",
          parameters: {
            type: "object",
            properties: {
              toolsets: {
                type: "array",
                items: { type: "string" },
                description: "ToolSet names to unload (e.g. file, mcp_postgres)",
              },
            },
            required: ["toolsets"],
          },
          handler: async (args) => {
            if (getToolContextKind() === "auto_llm") {
              return toolError("toolset_unload is not available in AutoLlm / policy-bound runs");
            }
            const ctx = await requireSessionMeta();
            if (!ctx.ok) return toolError(ctx.error);
            const raw = args.toolsets;
            if (!Array.isArray(raw) || raw.length === 0) {
              return toolError("toolsets must be a non-empty array");
            }
            const toolsets = raw.map((n) => String(n ?? "").trim()).filter(Boolean);
            if (toolsets.length === 0) return toolError("toolsets must be a non-empty array");
            const conversationId = getToolConversationId();
            if (!conversationId) return toolError("conversation_id is required");
            const registry = getToolRegistry();
            const result = await unloadToolSetsFromConversation(
              registry,
              conversationId,
              toolsets,
              ctx.meta,
            );
            revokeExecutableTools(result.revoked_tools);
            return toolResult({
              unloaded: result.unloaded,
              protected: result.protected,
              not_loaded: result.not_loaded,
              unknown: result.unknown,
            });
          },
        },
      ],
      CAPABILITIES_TOOLS_RETURNS,
    ),
  );
}
