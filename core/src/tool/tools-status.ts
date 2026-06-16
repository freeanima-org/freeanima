import { resolveDefaultSessionToolSets } from "./default-session-toolsets.ts";
import { globalToolErrorContract, resolveToolReturnFields } from "./return-contract.ts";
import {
  openaiFunctionSchema,
  type JsonSchemaObject,
  type OpenAiToolEntry,
  type ToolDef,
  type ToolReturnKind,
} from "./registry.ts";
import type { ToolSetRegistry } from "./toolset.ts";

/** Built-in LLM-readable plain-text tools (fallback when returnKind is unset) */
export const TEXT_RETURN_TOOL_NAMES = [
  "file_read",
  "terminal_run",
  "terminal_process",
  "code_execute",
] as const;

export type ToolsStatusToolItem = {
  name: string;
  description: string;
  toolset?: string;
  parameters: JsonSchemaObject;
  requires_env?: string[];
  definition: OpenAiToolEntry;
  return_kind: ToolReturnKind;
  return_schema?: JsonSchemaObject;
  return_example?: unknown;
  return_text_hint?: string;
  error_schema: JsonSchemaObject;
  error_example: { error: string };
};

export type ToolsStatusResponse = {
  default_toolsets: string[];
  tools: ToolsStatusToolItem[];
  toolsets: { name: string; description: string; tools: string[] }[];
};

const TEXT_RETURN_TOOL_SET = new Set<string>(TEXT_RETURN_TOOL_NAMES);

export function resolveReturnKind(toolset: string | undefined, def: ToolDef): ToolReturnKind {
  if (def.returnKind) return def.returnKind;
  if (toolset?.startsWith("mcp_") || toolset?.startsWith("acp_")) return "text";
  if (TEXT_RETURN_TOOL_SET.has(def.name)) return "text";
  return "json";
}

const MCP_ACP_TEXT_HINT = 'MCP/ACP server raw text output; on failure returns {"error":"..."} JSON';

export type BuildToolsStatusOptions = {
  toolSetNames?: readonly string[];
};

export function buildToolsStatus(
  registry: ToolSetRegistry,
  opts?: BuildToolsStatusOptions,
): ToolsStatusResponse {
  const filterNames = opts?.toolSetNames?.length
    ? new Set(opts.toolSetNames.map((n) => n.trim()).filter(Boolean))
    : null;

  const toolSetByName = new Map<string, string>();
  for (const ts of registry.listToolSets()) {
    if (filterNames && !filterNames.has(ts.name)) continue;
    for (const n of ts.tools) toolSetByName.set(n, ts.name);
  }

  const errorContract = globalToolErrorContract();

  const tools = registry
    .listTools()
    .filter((t) => toolSetByName.has(t.name))
    .map((t) => {
      const toolset = toolSetByName.get(t.name);
      const returnKind = resolveReturnKind(toolset, t);
      const returnFields = resolveToolReturnFields({ ...t, returnKind });
      const isDynamicRemote = toolset?.startsWith("mcp_") || toolset?.startsWith("acp_");

      const item: ToolsStatusToolItem = {
        name: t.name,
        description: t.description,
        toolset,
        parameters: t.parameters,
        definition: openaiFunctionSchema(t),
        return_kind: returnKind,
        error_schema: errorContract.error_schema,
        error_example: errorContract.error_example,
      };
      if (t.requiresEnv?.length) item.requires_env = [...t.requiresEnv];
      if (returnFields.return_schema) item.return_schema = returnFields.return_schema;
      if (returnFields.return_example !== undefined)
        item.return_example = returnFields.return_example;
      if (returnFields.return_text_hint) {
        item.return_text_hint = returnFields.return_text_hint;
      } else if (isDynamicRemote && returnKind === "text") {
        item.return_text_hint = MCP_ACP_TEXT_HINT;
        if (!item.return_schema) {
          item.return_schema = { type: "string", description: MCP_ACP_TEXT_HINT };
        }
      }
      return item;
    });

  const defaultToolSetNames = filterNames
    ? resolveDefaultSessionToolSets(registry).filter((n) => filterNames.has(n))
    : resolveDefaultSessionToolSets(registry);

  const listedToolSets = registry
    .listToolSets()
    .filter((ts) => !filterNames || filterNames.has(ts.name));

  return {
    default_toolsets: [...defaultToolSetNames],
    tools,
    toolsets: listedToolSets.map((ts) => ({
      name: ts.name,
      description: ts.description,
      tools: [...ts.tools],
    })),
  };
}
