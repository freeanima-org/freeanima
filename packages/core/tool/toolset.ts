import { parseToolArgs, type ParsedToolResult } from "./json-util.ts";
import {
  openaiFunctionSchema,
  type JsonSchemaObject,
  type OpenAiToolEntry,
  type ToolArgs,
  type ToolDef,
  type ToolHandler,
} from "./registry.ts";
import { injectToolCallTitle, shouldInjectToolCallTitle } from "./tool-call-title.ts";

export type { JsonSchemaObject, OpenAiToolEntry, ToolArgs, ToolDef, ToolHandler };

/** ToolSet discovery surface for system-prompt catalog and toolset_search. */
export type ToolSetVisibility = "hidden" | "searchable" | "catalog";

export const TOOL_SET_VISIBILITIES = ["hidden", "searchable", "catalog"] as const;

export function isToolSetVisibility(value: unknown): value is ToolSetVisibility {
  return value === "hidden" || value === "searchable" || value === "catalog";
}

/**
 * Normalize register / RPC opts into a visibility.
 * `visibility` wins; else `private: true` → hidden; else catalog.
 */
export function resolveToolSetVisibility(opts?: {
  visibility?: ToolSetVisibility;
  private?: boolean;
}): ToolSetVisibility {
  if (opts?.visibility != null && isToolSetVisibility(opts.visibility)) return opts.visibility;
  if (opts?.private === true) return "hidden";
  return "catalog";
}

export type ToolSet = {
  name: string;
  description: string;
  tools: readonly ToolDef[];
  /** Registered (pre-override) discovery visibility. */
  visibility: ToolSetVisibility;
};

/** Habitat / API view (effective visibility after overrides). */
export type ToolSetView = {
  name: string;
  description: string;
  tools: string[];
  visibility: ToolSetVisibility;
  /** True when a runtime override is applied for this name. */
  visibility_overridden?: boolean;
  /** @deprecated Derived from visibility === "hidden"; prefer `visibility`. */
  private?: boolean;
};

export type RegisterToolSetOpts = {
  visibility?: ToolSetVisibility;
  /** @deprecated Prefer `visibility`. `true` maps to `hidden`. */
  private?: boolean;
};

function freezeToolDef(def: ToolDef, toolSetName: string): ToolDef {
  const parameters = shouldInjectToolCallTitle(toolSetName)
    ? injectToolCallTitle(def.parameters)
    : def.parameters;
  return Object.freeze({ ...def, parameters });
}

/** ToolSet registry: ToolSet embeds ToolDef[]; LLM/execution layer flattens via flat API */
export class ToolSetRegistry {
  private readonly sets = new Map<string, ToolSet>();
  private readonly toolIndex = new Map<string, ToolDef>();
  private readonly toolOrder: string[] = [];
  /** Runtime overrides (e.g. habitat `toolset_visibility` config). */
  private readonly visibilityOverrides = new Map<string, ToolSetVisibility>();

  registerToolSet(
    name: string,
    description: string,
    tools: ToolDef[],
    opts?: RegisterToolSetOpts,
  ): void {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("ToolSet name is required");
    if (this.sets.has(trimmed)) {
      throw new Error(`ToolSet '${trimmed}' already registered`);
    }
    const frozenTools = Object.freeze(tools.map((def) => freezeToolDef(def, trimmed)));
    for (const def of frozenTools) {
      if (this.toolIndex.has(def.name)) {
        throw new Error(`Tool '${def.name}' already registered`);
      }
    }
    const visibility = resolveToolSetVisibility(opts);
    const toolSet: ToolSet = Object.freeze({
      name: trimmed,
      description,
      tools: frozenTools,
      visibility,
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
      const toolName = this.toolOrder[i];
      if (toolName !== undefined && !this.toolIndex.has(toolName)) this.toolOrder.splice(i, 1);
    }
    return removed;
  }

  getToolSet(name: string): ToolSet | undefined {
    return this.sets.get(name.trim());
  }

  /** Registered visibility (ignores runtime overrides). */
  getRegisteredVisibility(name: string): ToolSetVisibility | undefined {
    return this.sets.get(name.trim())?.visibility;
  }

  /** Effective visibility after overrides. Missing set → undefined. */
  getEffectiveVisibility(name: string): ToolSetVisibility | undefined {
    const trimmed = name.trim();
    const set = this.sets.get(trimmed);
    if (!set) return undefined;
    return this.visibilityOverrides.get(trimmed) ?? set.visibility;
  }

  /**
   * Replace all visibility overrides (hot-apply from config).
   * Pass empty object / clear to remove all overrides.
   */
  setVisibilityOverrides(overrides: Record<string, ToolSetVisibility>): void {
    this.visibilityOverrides.clear();
    for (const [rawName, visibility] of Object.entries(overrides)) {
      const name = rawName.trim();
      if (!name || !isToolSetVisibility(visibility)) continue;
      this.visibilityOverrides.set(name, visibility);
    }
  }

  /** Merge or clear a single override. `null` / undefined clears. */
  setVisibilityOverride(name: string, visibility: ToolSetVisibility | null): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (visibility == null) {
      this.visibilityOverrides.delete(trimmed);
      return;
    }
    if (!isToolSetVisibility(visibility)) return;
    this.visibilityOverrides.set(trimmed, visibility);
  }

  listToolSets(): ToolSetView[] {
    return [...this.sets.values()].map((ts) => {
      const overridden = this.visibilityOverrides.has(ts.name);
      const visibility = this.visibilityOverrides.get(ts.name) ?? ts.visibility;
      return {
        name: ts.name,
        description: ts.description,
        tools: ts.tools.map((t) => t.name),
        visibility,
        ...(overridden ? { visibility_overridden: true } : {}),
        ...(visibility === "hidden" ? { private: true } : {}),
      };
    });
  }

  /** Effective visibility === hidden (compat with former `private`). */
  isToolSetPrivate(name: string): boolean {
    return this.getEffectiveVisibility(name) === "hidden";
  }

  getTool(name: string): ToolDef | undefined {
    return this.toolIndex.get(name);
  }

  listTools(): ToolDef[] {
    return this.toolOrder
      .map((n) => this.toolIndex.get(n))
      .filter((t): t is ToolDef => t !== undefined);
  }

  /** Tools with exposeMcp=true for Habitat /mcp outbound */
  listMcpExposedTools(): ToolDef[] {
    return this.listTools().filter((t) => t.exposeMcp === true);
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
