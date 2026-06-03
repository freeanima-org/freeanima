import { parseToolArgs, type ParsedToolResult } from "./json-util";

/** JSON Schema object 子集（OpenAI function parameters） */
export type JsonSchemaObject = {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  enum?: unknown[];
  items?: unknown;
  [key: string]: unknown;
};

export type ToolArgs = Record<string, unknown>;

export type ToolHandler = (args: ToolArgs) => string | Promise<string>;

export type ToolDef = {
  name: string;
  description: string;
  parameters: JsonSchemaObject;
  handler: ToolHandler;
  requiresEnv?: string[];
  toolset?: string;
};

const registry = new Map<string, ToolDef>();
const order: string[] = [];

export function registerTool(def: ToolDef): void {
  if (!registry.has(def.name)) order.push(def.name);
  registry.set(def.name, def);
}

/** 按 toolset 移除已注册工具（MCP stop 时用） */
export function unregisterToolsByToolset(toolset: string): string[] {
  const removed: string[] = [];
  for (const t of listTools()) {
    if (t.toolset === toolset) {
      registry.delete(t.name);
      removed.push(t.name);
    }
  }
  for (let i = order.length - 1; i >= 0; i--) {
    if (!registry.has(order[i]!)) order.splice(i, 1);
  }
  return removed;
}

export function getTool(name: string): ToolDef | undefined {
  return registry.get(name);
}

export function listTools(): ToolDef[] {
  return order.map((n) => registry.get(n)!).filter(Boolean);
}

/** 将 ToolDef 转为 OpenAI Chat Completions `tools[]` 项 */
export function openaiFunctionSchema(t: ToolDef): {
  type: "function";
  function: { name: string; description: string; parameters: JsonSchemaObject };
} {
  return {
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  };
}

export type OpenAiToolEntry = ReturnType<typeof openaiFunctionSchema>;

export function openaiSchemas(): OpenAiToolEntry[] {
  return listTools().map((t) => openaiFunctionSchema(t));
}

export function checkEnvRequirements(): string[] {
  const missing: string[] = [];
  for (const t of listTools()) {
    for (const key of t.requiresEnv ?? []) {
      if (!process.env[key]) missing.push(key);
    }
  }
  return [...new Set(missing)];
}

/** 校验并解析工具参数 */
export function resolveToolArgs(
  raw: string | undefined | null,
): ParsedToolResult<ToolArgs> {
  return parseToolArgs(raw);
}
