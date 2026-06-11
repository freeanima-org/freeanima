import { estimateTokens, estimateToolsTokens } from "@freeanima/engine-compress";
import { PROFILE_CHAT } from "@freeanima/engine-provider-llm";
import { getProfileHopModel } from "@freeanima/service-config";
import { isSessionMeta } from "@freeanima/engine-db/domain";
import type { JsonSchemaObject } from "@freeanima/engine-tool";
import { loadSelfLayerPrompt } from "@freeanima/life-self";
import {
  composeSystemPrompt,
  decomposeSystemPromptParts,
  type SystemPromptParts,
} from "@freeanima/life-memory/system-prompt";
import { getServiceContext } from "../context.ts";
import {
  computeRuntimeContextBreakdown,
  type RuntimeContextBreakdown,
} from "./runtime-context-stats.ts";

export type PromptDebugToolItem = {
  name: string;
  description: string;
  toolset?: string;
  parameters: JsonSchemaObject;
};

export type PromptDebugResponse = {
  mode: "global" | "session";
  session_id?: string;
  system: {
    parts: SystemPromptParts;
    composed: string;
    stored?: string | null;
    in_sync?: boolean;
    breakdown: RuntimeContextBreakdown;
  };
  tools: {
    mode: "registry" | "session";
    count: number;
    tokens_est: number;
    items: PromptDebugToolItem[];
  };
  meta?: {
    cwd?: string | null;
    capability_mask?: { presets: string[] };
    tool_names?: string[];
  };
};

export function computeGlobalBreakdown(
  parts: SystemPromptParts,
  items: PromptDebugToolItem[],
): RuntimeContextBreakdown {
  const model = getProfileHopModel(getServiceContext().engine.config.data, PROFILE_CHAT);
  const system_self = estimateTokens(parts.self, model);
  const system_agents = estimateTokens(parts.agents, model);
  const system_resident = estimateTokens(parts.resident, model);
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
  const total = system_self + system_agents + system_resident + toolsTokens;
  return {
    system_self,
    system_agents,
    system_resident,
    summary: 0,
    messages: 0,
    tools: toolsTokens,
    total,
  };
}

function catalogTools() {
  return getServiceContext().engine.catalog.toolSets;
}

function registryToolItems(): PromptDebugToolItem[] {
  const toolSets = catalogTools();
  const toolSetByName = new Map<string, string>();
  for (const ts of toolSets.listToolSets()) {
    for (const n of ts.tools) toolSetByName.set(n, ts.name);
  }
  return toolSets.listTools().map((t) => ({
    name: t.name,
    description: t.description,
    toolset: toolSetByName.get(t.name),
    parameters: t.parameters,
  }));
}

function sessionToolItems(
  schemas: Array<{
    type: "function";
    function: {
      name: string;
      description?: string;
      parameters?: JsonSchemaObject;
    };
  }>,
): PromptDebugToolItem[] {
  const toolSets = catalogTools();
  const registry = new Map(toolSets.listTools().map((t) => [t.name, t]));
  const toolSetByName = new Map<string, string>();
  for (const ts of toolSets.listToolSets()) {
    for (const n of ts.tools) toolSetByName.set(n, ts.name);
  }
  return schemas.map((s) => {
    const def = registry.get(s.function.name);
    return {
      name: s.function.name,
      description: s.function.description ?? def?.description ?? "",
      toolset: toolSetByName.get(s.function.name),
      parameters: (s.function.parameters ??
        def?.parameters ?? { type: "object" }) as JsonSchemaObject,
    };
  });
}

async function buildSystemView(cwd?: string | null): Promise<{
  parts: SystemPromptParts;
  composed: string;
}> {
  const selfContent = await loadSelfLayerPrompt();
  const parts = await decomposeSystemPromptParts(selfContent, cwd ?? undefined);
  const composed = composeSystemPrompt(parts);
  return { parts, composed };
}

/** WebUI system prompt debug view (read-only) */
export async function getPromptDebug(sessionId?: string | null): Promise<PromptDebugResponse> {
  const id = sessionId?.trim() || null;

  if (!id) {
    const { parts, composed } = await buildSystemView(null);
    const items = registryToolItems();
    const breakdown = computeGlobalBreakdown(parts, items);
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

  const conv = getServiceContext().conversation;
  if (!(await conv.sessionExists(id))) {
    throw new Error(`Session not found: ${id}`);
  }

  const meta = await conv.loadSessionMeta(id);
  if (!isSessionMeta(meta)) {
    throw new Error(`Session not found: ${id}`);
  }

  const cwd = meta.cwd;
  const { parts, composed } = await buildSystemView(cwd);
  const stored = meta.system_prompt ?? null;
  const in_sync = stored === composed;

  const toolSchemas = await conv.loadSessionTools(id, meta);
  const items = sessionToolItems(toolSchemas);

  let breakdown: RuntimeContextBreakdown;
  try {
    breakdown = await computeRuntimeContextBreakdown(id);
  } catch {
    breakdown = computeGlobalBreakdown(parts, items);
  }

  return {
    mode: "session",
    session_id: id,
    system: {
      parts,
      composed,
      stored,
      in_sync,
      breakdown,
    },
    tools: {
      mode: "session",
      count: items.length,
      tokens_est: breakdown.tools,
      items,
    },
    meta: {
      cwd: cwd ?? null,
      capability_mask: meta.capability_mask
        ? { presets: [...(meta.capability_mask.presets ?? [])] }
        : undefined,
      tool_names: [...meta.tools],
    },
  };
}
