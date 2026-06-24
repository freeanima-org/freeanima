import { parseToolArgs, type ParsedToolResult } from "./json-util.ts";
import {
  openaiFunctionSchema,
  type JsonSchemaObject,
  type OpenAiToolEntry,
  type ToolArgs,
  type ToolDef,
  type ToolHandler,
} from "./registry.ts";

export type { JsonSchemaObject, OpenAiToolEntry, ToolArgs, ToolDef, ToolHandler };

export type ToolSet = {
  name: string;
  description: string;
  tools: readonly ToolDef[];
  /** When true, excluded from toolset_search and default conversation injection */
  private?: boolean;
};

/** WebUI / API view */
export type ToolSetView = {
  name: string;
  description: string;
  tools: string[];
  private?: boolean;
};

function freezeToolDef(def: ToolDef): ToolDef {
  return Object.freeze({ ...def });
}

/** ToolSet registry: ToolSet embeds ToolDef[]; LLM/execution layer flattens via flat API */
export class ToolSetRegistry {
  private readonly sets = new Map<string, ToolSet>();
  private readonly toolIndex = new Map<string, ToolDef>();
  private readonly toolOrder: string[] = [];

  registerToolSet(
    name: string,
    description: string,
    tools: ToolDef[],
    opts?: { private?: boolean },
  ): void {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("ToolSet name is required");
    if (this.sets.has(trimmed)) {
      throw new Error(`ToolSet '${trimmed}' already registered`);
    }
    const frozenTools = Object.freeze(tools.map(freezeToolDef)) as readonly ToolDef[];
    for (const def of frozenTools) {
      if (this.toolIndex.has(def.name)) {
        throw new Error(`Tool '${def.name}' already registered`);
      }
    }
    const toolSet: ToolSet = Object.freeze({
      name: trimmed,
      description,
      tools: frozenTools,
      ...(opts?.private ? { private: true } : {}),
    });
    this.sets.set(trimmed, toolSet);
    for (const def of frozenTools) {
      this.toolOrder.push(def.name);
      this.toolIndex.set(def.name, def);
    }
  }

  unregisterToolSet(name: string): string[] {
    const trimmed = name.trim();
    const set = this.sets.get(trimmed);
    if (!set) return [];
    const removed: string[] = [];
    for (const def of set.tools) {
      this.toolIndex.delete(def.name);
      removed.push(def.name);
    }
    this.sets.delete(trimmed);
    for (let i = this.toolOrder.length - 1; i >= 0; i--) {
      if (!this.toolIndex.has(this.toolOrder[i]!)) this.toolOrder.splice(i, 1);
    }
    return removed;
  }

  getToolSet(name: string): ToolSet | undefined {
    return this.sets.get(name.trim());
  }

  listToolSets(): ToolSetView[] {
    return [...this.sets.values()].map((ts) => ({
      name: ts.name,
      description: ts.description,
      tools: ts.tools.map((t) => t.name),
      ...(ts.private ? { private: true } : {}),
    }));
  }

  isToolSetPrivate(name: string): boolean {
    return this.sets.get(name.trim())?.private === true;
  }

  getTool(name: string): ToolDef | undefined {
    return this.toolIndex.get(name);
  }

  listTools(): ToolDef[] {
    return this.toolOrder.map((n) => this.toolIndex.get(n)!).filter(Boolean);
  }

  toolNames(): string[] {
    return this.listTools().map((t) => t.name);
  }

  openaiSchemas(): OpenAiToolEntry[] {
    return this.listTools().map((t) => openaiFunctionSchema(t));
  }

  openaiSchemasFromNames(names: string[]): OpenAiToolEntry[] {
    const out: OpenAiToolEntry[] = [];
    for (const name of names) {
      const def = this.getTool(name);
      if (def) out.push(openaiFunctionSchema(def));
    }
    return out;
  }

  checkEnvRequirements(): string[] {
    const missing: string[] = [];
    for (const t of this.listTools()) {
      for (const key of t.requiresEnv ?? []) {
        if (!process.env[key]) missing.push(key);
      }
    }
    return [...new Set(missing)];
  }

  resolveToolArgs(raw: string | undefined | null): ParsedToolResult<ToolArgs> {
    return parseToolArgs(raw);
  }
}

/** MCP server `gh` → toolset `mcp_gh` */
export function mcpToolSetId(serverName: string): string {
  return `mcp_${serverName.trim()}`;
}

/** ACP agent `cursor` → toolset `acp_cursor` */
export function acpToolSetId(agentName: string): string {
  return `acp_${agentName.trim()}`;
}
