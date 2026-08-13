import { PROFILE_REFLECT } from "@freeanima/host/core/provider";
import { getProfileHopModel } from "@freeanima/host/core/config";
import { getResolvedWorldContext } from "@freeanima/host/core/config/world-context";
import { applyDeepSleepToolResult } from "@freeanima/host/capabilities/memory";
import {
  registerLightSleepEngine,
  type LightSleepEngineInput,
  type LightSleepEngineResult,
} from "@freeanima/host/capabilities/memory/light-sleep-port";
import {
  registerDeepSleepEngine,
  type DeepSleepEngineInput,
  type DeepSleepEngineResult,
} from "@freeanima/host/capabilities/memory/deep-sleep-port";
import {
  registerAutobiographyEngine,
  type AutobiographyEngineInput,
  type AutobiographyEngineResult,
} from "@freeanima/host/capabilities/memory/autobiography-port";
import {
  registerDreamEngine,
  type DreamEngineInput,
  type DreamEngineResult,
} from "@freeanima/host/capabilities/memory/dream-engine-port";
import {
  registerTemporalSummaryEngine,
  type TemporalSummaryEngineInput,
  type TemporalSummaryEngineResult,
} from "@freeanima/host/capabilities/memory/temporal-summary";
import {
  registerSelfLayerRefreshEngine,
  type SelfLayerRefreshEngineInput,
  type SelfLayerRefreshEngineResult,
} from "@freeanima/host/capabilities/self/refresh-engine-port";
import { omitUndefined } from "@freeanima/host/core/util";

import type { FullRuntimeDeps } from "./runtime-deps.ts";
import { filterToolNamesByPolicy, resolveSleepCapabilityPolicy } from "./capability-policy-bind.ts";
import { runAutoLlm } from "./auto-llm-run.ts";
import { coerceString } from "@freeanima/shared/coerce-string";

const LIGHT_SLEEP_MAX_TURNS = 50;
const DEEP_SLEEP_MAX_TURNS = 100;

const SEMANTIC_MEMORY_WRITE_TOOLS = new Set([
  "memory_semantic_create",
  "memory_semantic_update",
  "memory_remember",
]);

function extractSemanticMemoryId(toolName: string, content: string): number | null {
  if (!SEMANTIC_MEMORY_WRITE_TOOLS.has(toolName)) return null;
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (parsed.error) return null;
    const raw = parsed.semantic_memory_id ?? parsed.id ?? parsed.fact_id;
    const n = typeof raw === "number" ? raw : Number(coerceString(raw ?? "").trim());
    if (!Number.isInteger(n) || n <= 0) return null;
    return n;
  } catch {
    return null;
  }
}

function extractLimbicMemoryId(toolName: string, content: string): string | null {
  if (toolName !== "memory_limbic_create") return null;
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (parsed.error) return null;
    const id = coerceString(parsed.id ?? "").trim();
    return id || null;
  } catch {
    return null;
  }
}

type SleepStreamInput = {
  systemPrompt: string;
  userMessages: string[];
  toolNames: string[];
};

type SleepStreamOptions = {
  runKind: string;
  runName: string;
  maxTurns: number;
  metadata?: Record<string, unknown>;
  onToolResult?: (name: string, content: string) => void;
};

async function runSleepStream(
  deps: FullRuntimeDeps,
  input: SleepStreamInput,
  opts: SleepStreamOptions,
): Promise<{ summary: string; toolCalls: number }> {
  const model = getProfileHopModel(deps.engine.config.data, PROFILE_REFLECT);
  const sleepPolicy = resolveSleepCapabilityPolicy(deps);
  const toolNames = filterToolNamesByPolicy(input.toolNames, sleepPolicy);

  const result = await runAutoLlm(
    deps,
    omitUndefined({
      runName: opts.runName,
      runKind: opts.runKind,
      subjectId: getResolvedWorldContext().agent_subject_id,
      systemPrompt: input.systemPrompt,
      userMessages: input.userMessages,
      model,
      toolNames,
      maxTurns: opts.maxTurns,
      toolPolicy: sleepPolicy,
      metadata: opts.metadata,
      onToolResult: opts.onToolResult,
    }),
  );

  if (result.status === "error") {
    throw new Error(result.error ?? result.output);
  }
  return { summary: result.output.slice(0, 2000), toolCalls: result.toolCalls };
}

async function runLightSleepTurn(
  deps: FullRuntimeDeps,
  input: LightSleepEngineInput,
): Promise<LightSleepEngineResult> {
  const semanticMemoryIds: number[] = [];
  const limbicMemoryIds: string[] = [];
  const { summary, toolCalls } = await runSleepStream(deps, input, {
    runKind: "light-sleep",
    runName: `light-sleep/${input.stage}`,
    maxTurns: LIGHT_SLEEP_MAX_TURNS,
    metadata: { stage: input.stage },
    onToolResult: (name, content) => {
      const semanticId = extractSemanticMemoryId(name, content);
      if (semanticId && !semanticMemoryIds.includes(semanticId)) {
        semanticMemoryIds.push(semanticId);
      }
      const limbicId = extractLimbicMemoryId(name, content);
      if (limbicId && !limbicMemoryIds.includes(limbicId)) {
        limbicMemoryIds.push(limbicId);
      }
    },
  });
  return {
    summary,
    tool_calls: toolCalls,
    semantic_memory_ids: semanticMemoryIds,
    limbic_memory_ids: limbicMemoryIds,
  };
}

async function runDeepSleepTurn(
  deps: FullRuntimeDeps,
  input: DeepSleepEngineInput,
): Promise<DeepSleepEngineResult> {
  const { summary, toolCalls } = await runSleepStream(deps, input, {
    runKind: "deep-sleep",
    runName: `deep-sleep/${input.round}`,
    maxTurns: DEEP_SLEEP_MAX_TURNS,
    metadata: { round: input.round },
    onToolResult: (name, content) => {
      if (input.changeLog) {
        applyDeepSleepToolResult(input.changeLog, name, content);
      }
    },
  });
  return { summary, tool_calls: toolCalls };
}

async function runAutobiographyTurn(
  deps: FullRuntimeDeps,
  input: AutobiographyEngineInput,
): Promise<AutobiographyEngineResult> {
  const { summary, toolCalls } = await runSleepStream(deps, input, {
    runKind: "self-autobiography",
    runName: "self-autobiography",
    maxTurns: 20,
  });
  return { summary, tool_calls: toolCalls };
}

async function runDreamTurn(
  deps: FullRuntimeDeps,
  input: DreamEngineInput,
): Promise<DreamEngineResult> {
  const result = await runAutoLlm(deps, {
    runName: "dream",
    runKind: "dream",
    subjectId: getResolvedWorldContext().agent_subject_id,
    systemPrompt: input.systemPrompt,
    userMessages: [input.userMessage],
    model: getProfileHopModel(deps.engine.config.data, PROFILE_REFLECT),
    toolNames: [],
    maxTurns: 1,
    metadata: { dream: true },
  });
  if (result.status === "error") {
    throw new Error(result.error ?? "dream LLM failed");
  }
  return { content: result.output.trim() };
}

async function runTemporalSummaryTurn(
  deps: FullRuntimeDeps,
  input: TemporalSummaryEngineInput,
): Promise<TemporalSummaryEngineResult> {
  const result = await runAutoLlm(deps, {
    runName: "temporal-summary",
    runKind: "temporal-summary",
    subjectId: getResolvedWorldContext().agent_subject_id,
    systemPrompt: input.systemPrompt,
    userMessages: [input.userMessage],
    model: getProfileHopModel(deps.engine.config.data, PROFILE_REFLECT),
    toolNames: [],
    maxTurns: 1,
    metadata: { temporal_summary: true },
  });
  if (result.status === "error") {
    throw new Error(result.error ?? "temporal summary LLM failed");
  }
  return { content: result.output.trim() };
}

async function runSelfLayerRefreshTurn(
  deps: FullRuntimeDeps,
  input: SelfLayerRefreshEngineInput,
): Promise<SelfLayerRefreshEngineResult> {
  const result = await runAutoLlm(deps, {
    runName: "self-layer-refresh",
    runKind: "self-layer-refresh",
    subjectId: getResolvedWorldContext().agent_subject_id,
    systemPrompt: input.systemPrompt,
    userMessages: [input.userMessage],
    model: getProfileHopModel(deps.engine.config.data, PROFILE_REFLECT),
    toolNames: [],
    maxTurns: 1,
    metadata: { self_layer_refresh: true },
  });
  if (result.status === "error") {
    throw new Error(result.error ?? "self-layer refresh LLM failed");
  }
  return { content: result.output.trim() };
}

/** Register light/deep/autobiography/dream/temporal-summary/self-layer-refresh LLM engines */
export function registerMemoryEngines(deps: FullRuntimeDeps): void {
  registerLightSleepEngine((input) => runLightSleepTurn(deps, input));
  registerDeepSleepEngine((input) => runDeepSleepTurn(deps, input));
  registerAutobiographyEngine((input) => runAutobiographyTurn(deps, input));
  registerDreamEngine((input) => runDreamTurn(deps, input));
  registerTemporalSummaryEngine((input) => runTemporalSummaryTurn(deps, input));
  registerSelfLayerRefreshEngine((input) => runSelfLayerRefreshTurn(deps, input));
}
