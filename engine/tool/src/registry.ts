import { parseToolArgs, type ParsedToolResult } from "./json-util.ts";

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

/** Tool 注册表；由 Engine / service 实例化，模块级函数委托 defaultToolRegistry */
export class ToolRegistry {
  private readonly registry = new Map<string, ToolDef>();
  private readonly order: string[] = [];

  register(def: ToolDef): void {
    if (!this.registry.has(def.name)) this.order.push(def.name);
    this.registry.set(def.name, def);
  }

  /** 按 toolset 移除已注册工具（MCP stop 时用） */
  unregisterToolsByToolset(toolset: string): string[] {
    const removed: string[] = [];
    for (const t of this.list()) {
      if (t.toolset === toolset) {
        this.registry.delete(t.name);
        removed.push(t.name);
      }
    }
    for (let i = this.order.length - 1; i >= 0; i--) {
      if (!this.registry.has(this.order[i]!)) this.order.splice(i, 1);
    }
    return removed;
  }

  get(name: string): ToolDef | undefined {
    return this.registry.get(name);
  }

  list(): ToolDef[] {
    return this.order.map((n) => this.registry.get(n)!).filter(Boolean);
  }

  openaiSchemas(): OpenAiToolEntry[] {
    return this.list().map((t) => openaiFunctionSchema(t));
  }

  checkEnvRequirements(): string[] {
    const missing: string[] = [];
    for (const t of this.list()) {
      for (const key of t.requiresEnv ?? []) {
        if (!process.env[key]) missing.push(key);
      }
    }
    return [...new Set(missing)];
  }

  /** 校验并解析工具参数 */
  resolveToolArgs(raw: string | undefined | null): ParsedToolResult<ToolArgs> {
    return parseToolArgs(raw);
  }
}

/** 全局默认注册表（与 legacy registerTool 行为一致） */
export const defaultToolRegistry = new ToolRegistry();

export function registerTool(def: ToolDef): void {
  defaultToolRegistry.register(def);
}

export function unregisterToolsByToolset(toolset: string): string[] {
  return defaultToolRegistry.unregisterToolsByToolset(toolset);
}

export function getTool(name: string): ToolDef | undefined {
  return defaultToolRegistry.get(name);
}

export function listTools(): ToolDef[] {
  return defaultToolRegistry.list();
}

export function openaiSchemas(): OpenAiToolEntry[] {
  return defaultToolRegistry.openaiSchemas();
}

export function checkEnvRequirements(): string[] {
  return defaultToolRegistry.checkEnvRequirements();
}

export function resolveToolArgs(raw: string | undefined | null): ParsedToolResult<ToolArgs> {
  return defaultToolRegistry.resolveToolArgs(raw);
}
