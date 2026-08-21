import { PROFILE_REFLECT } from "@freeanima/habitat/core/provider";
import { getProfileHopModel } from "@freeanima/habitat/core/config";
import { applyDeepSleepToolResult } from "@freeanima/habitat/capabilities/memory";
import {
  registerAutobiographyEngine,
  type AutobiographyEngineInput,
  type AutobiographyEngineResult,
} from "@freeanima/habitat/capabilities/memory/autobiography-port";
import {
  registerTemporalSummaryEngine,
  type TemporalSummaryEngineInput,
  type TemporalSummaryEngineResult,
} from "@freeanima/habitat/capabilities/memory/temporal-summary";
import {
  registerSelfLayerRefreshEngine,
  type SelfLayerRefreshEngineInput,
  type SelfLayerRefreshEngineResult,
} from "@freeanima/habitat/capabilities/self/refresh-engine-port";
import {
  registerRetainLlm,
  type RetainLlmInput,
  type RetainLlmResult,
} from "@freeanima/habitat/capabilities/memory/service/retain-llm-port";
import {
  registerReflectLlm,
  type ReflectLlmInput,
  type ReflectLlmResult,
} from "@freeanima/habitat/capabilities/memory/service/reflect-llm-port";
import { omitUndefined } from "@freeanima/habitat/core/util";
import { composeAutoLlmPrompt } from "@freeanima/habitat/core/llm/auto-llm-prompt";
import { PROMPT_XML_TAGS } from "@freeanima/habitat/core/hooks/prompt";

import type { FullRuntimeDeps } from "./runtime-deps.ts";
import { filterToolNamesByPolicy, resolveSleepCapabilityPolicy } from "./capability-policy-bind.ts";
import { AUTO_LLM_DEFAULT_MAX_DURATION_MS, runAutoLlm } from "./auto-llm-run.ts";
import { coerceString } from "@freeanima/shared/coerce-string";
import { asRecord } from "@freeanima/shared/util";

const RETAIN_MAX_LOOP_ITERATIONS = 50;
/** 合轮后：1 次批量 toolcalls + 最多 1 轮摘要；禁止多轮试探式工具环 */
const REFLECT_MAX_TURNS = 2;

const SEMANTIC_MEMORY_WRITE_TOOLS = new Set([
  "memory_semantic_create",
  "memory_semantic_update",
  "memory_remember",
]);

function extractSemanticMemoryId(toolName: string, content: string): number | null {
  if (!SEMANTIC_MEMORY_WRITE_TOOLS.has(toolName)) return null;
  try {
    const parsed = asRecord(JSON.parse(content));
    if (!parsed || parsed.error) return null;
    const raw = parsed.semantic_memory_id ?? parsed.id ?? parsed.fact_id;
    const n = typeof raw === "number" ? raw : Number(coerceString(raw ?? "").trim());
    if (!Number.isInteger(n) || n <= 0) return null;
    return n;
  } catch {
    return null;
  }
}

type ReflectStreamInput = {
  systemPrompt: string;
  userMessages: string[];
  toolNames: string[];
};

type ReflectStreamOptions = {
  runKind: string;
  runName: string;
  maxLoopIterations: number;
  metadata?: Record<string, unknown>;
  onToolResult?: (name: string, content: string) => void;
  subjectId?: number;
};

async function resolveEngineSubjectId(opts: {
  subjectId?: number;
  metadata?: Record<string, unknown>;
}): Promise<number> {
  if (opts.subjectId != null && opts.subjectId > 0) return opts.subjectId;
  const metaAgent = opts.metadata?.agent_subject_id;
  if (typeof metaAgent === "number" && metaAgent > 0) return metaAgent;
  const { getActiveRetainAgentSubjectId } =
    await import("@freeanima/habitat/capabilities/memory/service/retain-context.ts");
  const retainAgent = getActiveRetainAgentSubjectId();
  if (retainAgent != null && retainAgent > 0) return retainAgent;
  const { getActiveRetainProvenance } =
    await import("@freeanima/habitat/capabilities/memory/service/retain-context.ts");
  const provenance = getActiveRetainProvenance();
  if (provenance?.conversation_id) {
    const { resolveBoundAgentForConversation } =
      await import("@freeanima/habitat/engine/conversation/resolve-conversation-agent.ts");
    return (await resolveBoundAgentForConversation(provenance.conversation_id)).agent_subject_id;
  }
  // 无会话绑定的维护路径须由调用方显式传入 subjectId
  throw new Error(
    "AutoLlm acting subject unresolved; pass subjectId or bind conversation / retain context",
  );
}

async function runReflectStream(
  deps: FullRuntimeDeps,
  input: ReflectStreamInput,
  opts: ReflectStreamOptions,
): Promise<{ summary: string; toolCalls: number }> {
  const model = getProfileHopModel(deps.engine.config.data, PROFILE_REFLECT);
  const sleepPolicy = resolveSleepCapabilityPolicy(deps);
  const toolNames = filterToolNamesByPolicy(input.toolNames, sleepPolicy);

  // retain 等调用方若已 compose，system 已含 protocol；再包一层会重复——仅当尚未含 protocol 时包装
  const alreadyComposed = input.systemPrompt.includes(`<${PROMPT_XML_TAGS.autoLlmProtocol}>`);
  const prompt = alreadyComposed
    ? { systemPrompt: input.systemPrompt, userMessages: input.userMessages }
    : composeAutoLlmPrompt({
        kind: opts.runKind,
        taskSpec: input.systemPrompt,
        dataParts: input.userMessages.map((body) => ({ body })),
      });

  const subjectId = await resolveEngineSubjectId({
    ...(opts.subjectId != null ? { subjectId: opts.subjectId } : {}),
    ...(opts.metadata ? { metadata: opts.metadata } : {}),
  });

  const result = await runAutoLlm(
    deps,
    omitUndefined({
      runName: opts.runName,
      runKind: opts.runKind,
      subjectId,
      systemPrompt: prompt.systemPrompt,
      userMessages: prompt.userMessages,
      model,
      toolNames,
      maxLoopIterations: opts.maxLoopIterations,
      maxDurationMs: AUTO_LLM_DEFAULT_MAX_DURATION_MS,
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

async function runAutobiographyTurn(
  deps: FullRuntimeDeps,
  input: AutobiographyEngineInput,
): Promise<AutobiographyEngineResult> {
  const { summary, toolCalls } = await runReflectStream(deps, input, {
    runKind: "self-autobiography",
    runName: "self-autobiography",
    maxLoopIterations: 20,
  });
  return { summary, tool_calls: toolCalls };
}

async function runTemporalSummaryTurn(
  deps: FullRuntimeDeps,
  input: TemporalSummaryEngineInput,
): Promise<TemporalSummaryEngineResult> {
  // summarizeTemporalText 已 composeAutoLlmPrompt（含 protocol / task_params）
  const subjectId = await resolveEngineSubjectId(
    input.agent_subject_id != null ? { subjectId: input.agent_subject_id } : {},
  );
  const result = await runAutoLlm(deps, {
    runName: "temporal-summary",
    runKind: "temporal-summary",
    subjectId,
    systemPrompt: input.systemPrompt,
    userMessages: input.userMessages,
    model: getProfileHopModel(deps.engine.config.data, PROFILE_REFLECT),
    toolNames: [],
    maxLoopIterations: 1,
    maxDurationMs: AUTO_LLM_DEFAULT_MAX_DURATION_MS,
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
  // input.systemPrompt = 维护任务规格；userMessage = 证据 + 当前可维护块
  const { systemPrompt, userMessages } = composeAutoLlmPrompt({
    kind: "self-layer-refresh",
    taskSpec: input.systemPrompt,
    dataParts: [{ body: input.userMessage }],
  });
  const result = await runAutoLlm(deps, {
    runName: "self-layer-refresh",
    runKind: "self-layer-refresh",
    subjectId: input.agent_subject_id,
    systemPrompt,
    userMessages,
    model: getProfileHopModel(deps.engine.config.data, PROFILE_REFLECT),
    toolNames: [],
    maxLoopIterations: 1,
    maxDurationMs: AUTO_LLM_DEFAULT_MAX_DURATION_MS,
    metadata: { self_layer_refresh: true, agent_subject_id: input.agent_subject_id },
  });
  if (result.status === "error") {
    throw new Error(result.error ?? "self-layer refresh LLM failed");
  }
  return { content: result.output.trim() };
}

async function runReflectTurn(
  deps: FullRuntimeDeps,
  input: ReflectLlmInput,
): Promise<ReflectLlmResult> {
  const { summary, toolCalls } = await runReflectStream(deps, input, {
    runKind: "memory-reflect",
    runName: `memory-reflect/${input.round}`,
    maxLoopIterations: REFLECT_MAX_TURNS,
    metadata: omitUndefined({
      reflect: true,
      round: input.round,
      agent_subject_id: input.agent_subject_id,
    }),
    ...(input.agent_subject_id != null ? { subjectId: input.agent_subject_id } : {}),
    onToolResult: (name, content) => {
      if (input.changeLog) {
        applyDeepSleepToolResult(input.changeLog, name, content);
      }
    },
  });
  return { summary, tool_calls: toolCalls };
}

async function runRetainTurn(
  deps: FullRuntimeDeps,
  input: RetainLlmInput,
): Promise<RetainLlmResult> {
  const semanticMemoryIds: number[] = [];
  const { summary, toolCalls } = await runReflectStream(deps, input, {
    runKind: "memory-retain",
    runName: "memory-retain",
    maxLoopIterations: RETAIN_MAX_LOOP_ITERATIONS,
    metadata: { retain: true },
    onToolResult: (name, content) => {
      const semanticId = extractSemanticMemoryId(name, content);
      if (semanticId && !semanticMemoryIds.includes(semanticId)) {
        semanticMemoryIds.push(semanticId);
      }
    },
  });
  return {
    summary,
    tool_calls: toolCalls,
    semantic_memory_ids: semanticMemoryIds,
  };
}

/** Register retain/reflect + autobiography/temporal/self-layer LLM engines */
export function registerMemoryEngines(deps: FullRuntimeDeps): void {
  registerRetainLlm((input) => runRetainTurn(deps, input));
  registerReflectLlm((input) => runReflectTurn(deps, input));
  registerAutobiographyEngine((input) => runAutobiographyTurn(deps, input));
  registerTemporalSummaryEngine((input) => runTemporalSummaryTurn(deps, input));
  registerSelfLayerRefreshEngine((input) => runSelfLayerRefreshTurn(deps, input));
}
