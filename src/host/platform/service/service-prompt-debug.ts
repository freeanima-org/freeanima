import { estimateTokens, estimateToolsTokens } from "@freeanima/host/core/compress";
import { PROFILE_CHAT } from "@freeanima/host/core/provider";
import { getProfileHopModel } from "@freeanima/host/platform/config";
import { isConversationMeta } from "@freeanima/host/core/db/domain";
import type { JsonSchemaObject } from "@freeanima/host/core/tool";
import { descriptionWithReturnSchema } from "@freeanima/host/core/tool";
import { buildSystemPrompt } from "@freeanima/host/core/hooks/prompt";
import { renderToolsetsSection } from "@freeanima/host/capabilities/tools/toolset-prompt";
import { loadSelfLayerPrompt } from "@freeanima/host/capabilities/self";
import {
  decomposeSystemPromptParts,
  type SystemPromptParts,
} from "@freeanima/host/capabilities/memory/system-prompt";
import { omitUndefined } from "@freeanima/host/core/util";
import type { RuntimeDeps } from "./runtime-deps.ts";
import {
  computeRuntimeContextBreakdown,
  type RuntimeContextBreakdown,
} from "./runtime-context-stats.ts";

export type PromptDebugToolItem = {
  name: string;
  description: string;
  toolset?: string;
  parameters: JsonSchemaObject;
  return_schema?: JsonSchemaObject;
};

export type PromptDebugResponse = {
  mode: "global" | "conversation";
  conversation_id?: string;
  system: {
    parts: SystemPromptParts;
    composed: string;
    stored?: string | null;
    in_sync?: boolean;
    breakdown: RuntimeContextBreakdown;
  };
  tools: {
    mode: "registry" | "conversation";
    count: number;
    tokens_est: number;
    items: PromptDebugToolItem[];
  };
  meta?: {
    cwd?: string | null;
    tool_names?: string[];
    staged_toolsets?: string[];
  };
};

export function computeGlobalBreakdown(
  deps: RuntimeDeps,
  parts: SystemPromptParts,
  items: PromptDebugToolItem[],
): RuntimeContextBreakdown {
  const model = getProfileHopModel(deps.engine.config.data, PROFILE_CHAT);
  const system_self = estimateTokens(parts.self, model);
  const system_agents = estimateTokens(parts.agents, model);
  const system_resident = estimateTokens(parts.resident, model);
  const system_toolsets = estimateTokens(parts.toolsets, model);
  const toolsTokens = estimateToolsTokens(
    items.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    })),
    model,
  );
  const total = system_self + system_agents + system_resident + system_toolsets + toolsTokens;
  return {
    system_self,
    system_agents,
    system_resident,
    system_toolsets,
    summary: 0,
    messages: 0,
    tools: toolsTokens,
    total,
  };
}

function registryToolItems(deps: RuntimeDeps): PromptDebugToolItem[] {
  const toolSets = deps.engine.catalog.toolSets;
  const toolSetByName = new Map<string, string>();
  for (const ts of toolSets.listToolSets()) {
    for (const n of ts.tools) toolSetByName.set(n, ts.name);
  }
  return toolSets.listTools().map((t) =>
    omitUndefined({
      name: t.name,
      description: descriptionWithReturnSchema(t.description, t.returnSchema),
      toolset: toolSetByName.get(t.name),
      parameters: t.parameters,
      return_schema: t.returnSchema,
    }),
  );
}

function conversationToolItems(
  deps: RuntimeDeps,
  schemas: Array<{
    type: "function";
    function: {
      name: string;
      description?: string;
      parameters?: JsonSchemaObject;
    };
  }>,
): PromptDebugToolItem[] {
  const toolSets = deps.engine.catalog.toolSets;
  const registry = new Map(toolSets.listTools().map((t) => [t.name, t]));
  const toolSetByName = new Map<string, string>();
  for (const ts of toolSets.listToolSets()) {
    for (const n of ts.tools) toolSetByName.set(n, ts.name);
  }
  return schemas.map((s) => {
    const def = registry.get(s.function.name);
    return omitUndefined({
      name: s.function.name,
      description: s.function.description ?? def?.description ?? "",
      toolset: toolSetByName.get(s.function.name),
      parameters: (s.function.parameters ??
        def?.parameters ?? { type: "object" }) as JsonSchemaObject,
      return_schema: def?.returnSchema,
    });
  });
}

async function buildSystemView(
  deps: RuntimeDeps,
  cwd?: string | null,
  meta?: import("@freeanima/host/core/db/domain").ConversationMetaMessage,
): Promise<{
  parts: SystemPromptParts;
  composed: string;
}> {
  const selfContent = await loadSelfLayerPrompt();
  const memoryParts = await decomposeSystemPromptParts(selfContent, cwd ?? undefined);
  const toolsets = renderToolsetsSection(deps.engine.catalog.toolSets);
  const parts: SystemPromptParts = { ...memoryParts, toolsets };
  const composed = await buildSystemPrompt([], cwd ?? undefined, meta);
  return { parts, composed };
}

/** Habitat system prompt debug view (read-only) */
export async function getPromptDebug(
  deps: RuntimeDeps,
  conversationId?: string | null,
): Promise<PromptDebugResponse> {
  const id = conversationId?.trim() || null;

  if (!id) {
    const { parts, composed } = await buildSystemView(deps, null);
    const items = registryToolItems(deps);
    const breakdown = computeGlobalBreakdown(deps, parts, items);
    return {
      mode: "global",
      system: {
        parts,
        composed,
        breakdown,
      },
      tools: {
        mode: "registry",
        count: items.length,
        tokens_est: breakdown.tools,
        items,
      },
    };
  }

  if (!(await deps.conversation.conversationExists(id))) {
    throw new Error(`Conversation not found: ${id}`);
  }

  const meta = await deps.conversation.loadConversationMeta(id);
  if (!isConversationMeta(meta)) {
    throw new Error(`Conversation not found: ${id}`);
  }

  const cwd = meta.cwd;
  const { parts, composed } = await buildSystemView(deps, cwd, meta);
  const stored = meta.system_prompt ?? null;
  const in_sync = stored === composed;

  const toolSchemas = await deps.conversation.loadConversationTools(id, meta);
  const items = conversationToolItems(
    deps,
    toolSchemas.map((s) => ({
      type: "function" as const,
      function: omitUndefined({
        name: s.function.name,
        description: s.function.description,
        parameters: s.function.parameters,
      }),
    })),
  );

  let breakdown: RuntimeContextBreakdown;
  try {
    breakdown = await computeRuntimeContextBreakdown(deps, id);
  } catch {
    breakdown = computeGlobalBreakdown(deps, parts, items);
  }

  return {
    mode: "conversation",
    conversation_id: id,
    system: {
      parts,
      composed,
      stored,
      in_sync,
      breakdown,
    },
    tools: {
      mode: "conversation",
      count: items.length,
      tokens_est: breakdown.tools,
      items,
    },
    meta: omitUndefined({
      cwd: cwd ?? null,
      tool_names: [...(meta.cached_toolsets ?? [])],
      staged_toolsets: [...(meta.staged_toolsets ?? [])],
    }),
  };
}
