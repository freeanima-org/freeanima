import { resolveDefaultSessionTools } from "./default-session-tools.ts";
import {
  openaiFunctionSchema,
  type JsonSchemaObject,
  type OpenAiToolEntry,
  type ToolDef,
  type ToolReturnKind,
} from "./registry.ts";
import type { ToolSetRegistry } from "./toolset.ts";

/** 内置 LLM 可读纯文本工具（无显式 returnKind 时回退） */
export const TEXT_RETURN_TOOL_NAMES = [
  "file_read_file",
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
};

export type ToolsStatusResponse = {
  default_tools: string[];
  tools: ToolsStatusToolItem[];
  tool_sets: { name: string; description: string; tools: string[] }[];
};

const TEXT_RETURN_TOOL_SET = new Set<string>(TEXT_RETURN_TOOL_NAMES);

export function resolveReturnKind(toolset: string | undefined, def: ToolDef): ToolReturnKind {
  if (def.returnKind) return def.returnKind;
  if (toolset?.startsWith("mcp_") || toolset?.startsWith("acp_")) return "text";
  if (TEXT_RETURN_TOOL_SET.has(def.name)) return "text";
  return "json";
}

export function buildToolsStatus(registry: ToolSetRegistry): ToolsStatusResponse {
  const toolSetByName = new Map<string, string>();
  for (const ts of registry.listToolSets()) {
    for (const n of ts.tools) toolSetByName.set(n, ts.name);
  }

  const tools = registry.listTools().map((t) => {
    const toolset = toolSetByName.get(t.name);
    const item: ToolsStatusToolItem = {
      name: t.name,
      description: t.description,
      toolset,
      parameters: t.parameters,
      definition: openaiFunctionSchema(t),
      return_kind: resolveReturnKind(toolset, t),
    };
    if (t.requiresEnv?.length) item.requires_env = [...t.requiresEnv];
    if (t.returnSchema) item.return_schema = t.returnSchema;
    return item;
  });

  return {
    default_tools: resolveDefaultSessionTools(registry),
    tools,
    tool_sets: registry.listToolSets().map((ts) => ({
      name: ts.name,
      description: ts.description,
      tools: [...ts.tools],
    })),
  };
}
