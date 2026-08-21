import { formatSkillsPrefix, skillPolicyFragments } from "@freeanima/habitat/core/skill";
import {
  resolveSubagentToolPolicy,
  materializeToolNames,
} from "@freeanima/habitat/core/capability-policy";
import { getProfileHopFormat, getProfileHopModel } from "@freeanima/habitat/core/config";
import {
  PROFILE_CHAT,
  resolveSamplingRanges,
  temperatureTierSchema,
  temperatureTierToCallParams,
  type TemperatureTier,
} from "@freeanima/habitat/core/provider";
import { omitUndefined } from "@freeanima/habitat/core/util";
import {
  getToolConversationId,
  reportToolProgress,
  toolResult,
} from "@freeanima/habitat/core/tool";
import { composeAutoLlmPrompt } from "@freeanima/habitat/core/llm/auto-llm-prompt";
import { PROMPT_XML_TAGS } from "@freeanima/habitat/core/hooks/prompt";
import { resolveBoundAgentForConversation } from "@freeanima/habitat/engine/conversation/resolve-conversation-agent.ts";

import {
  AUTO_LLM_DEFAULT_MAX_DURATION_MS,
  runAutoLlm,
  type AutoLlmRunResult,
  type AutoLlmToolStep,
} from "../auto-llm-run.ts";
import type { FullRuntimeDeps } from "../runtime-deps.ts";
import {
  getSubagent,
  getSubagentBySlug,
} from "@freeanima/features/subagent/domain/subagent-store.ts";
import {
  buildSubagentOptInSections,
  formatSubagentGoalSection,
  formatSubagentRoleSection,
  mergePromptIncludes,
} from "@freeanima/features/subagent/domain/subagent-prompt.ts";
import type {
  ResolvedSubagentProfile,
  SubagentTaskInput,
} from "@freeanima/features/subagent/domain/types.ts";

export const SUBAGENT_HARD_DENY_TOOLS = [
  "subagent_run",
  "subagent_list",
  "subagent_get",
  "subagent_create",
  "subagent_update",
  "subagent_delete",
] as const;

const DEFAULT_SUBAGENT_MAX_LOOP_ITERATIONS = 20;
const DEFAULT_SUBAGENT_MAX_PARALLEL = 4;
const DEFAULT_SUBAGENT_TEMPERATURE_TIER: TemperatureTier = "balanced";
const EPHEMERAL_SLUG = "ephemeral";

export type SubagentRunTaskResult = {
  run_id: string;
  slug: string;
  subagent_entity_id: number;
  status: "ok" | "error";
  output: string;
  tool_calls: number;
  steps?: AutoLlmToolStep[];
  error?: string;
  duration_ms: number;
};

/** 运行中进度槽（与终态 results[] 同形，status 可为 running） */
type SubagentLiveSlot = {
  run_id: string;
  slug: string;
  subagent_entity_id: number;
  status: "running" | "ok" | "error";
  output: string;
  tool_calls: number;
  steps?: AutoLlmToolStep[];
  error?: string;
  duration_ms: number;
};

function publishSubagentProgress(
  slots: Array<SubagentLiveSlot | undefined>,
  tasks: SubagentTaskInput[],
): void {
  const results = slots.map((slot, i) => {
    if (slot) {
      return omitUndefined({
        run_id: slot.run_id,
        slug: slot.slug,
        subagent_entity_id: slot.subagent_entity_id,
        status: slot.status,
        output: slot.output,
        tool_calls: slot.tool_calls,
        steps: slot.steps,
        error: slot.error,
        duration_ms: slot.duration_ms,
      });
    }
    const task = tasks[i];
    const emptySteps: AutoLlmToolStep[] = [];
    return {
      run_id: "",
      slug: task?.slug?.trim() || EPHEMERAL_SLUG,
      subagent_entity_id: task?.id ?? 0,
      status: "running" as const,
      output: "",
      tool_calls: 0,
      steps: emptySteps,
      duration_ms: 0,
    };
  });
  reportToolProgress(
    toolResult({
      ok: true,
      action: "run",
      count: results.length,
      results,
    }),
  );
}

function resolveMaxLoopIterations(
  deps: FullRuntimeDeps,
  profile: ResolvedSubagentProfile,
  override?: number,
): number {
  if (override != null && override > 0) return override;
  if (profile.max_loop_iterations != null && profile.max_loop_iterations > 0)
    return profile.max_loop_iterations;
  return (
    deps.engine.config.data.auto_llm?.subagent?.max_loop_iterations ??
    DEFAULT_SUBAGENT_MAX_LOOP_ITERATIONS
  );
}

/** 调用 > 档案 > auto_llm.subagent.temperature_tier > balanced */
export function resolveTemperatureTier(
  deps: FullRuntimeDeps,
  profile: ResolvedSubagentProfile,
  override?: TemperatureTier,
): TemperatureTier {
  if (override != null) {
    const parsed = temperatureTierSchema.safeParse(override);
    if (parsed.success) return parsed.data;
  }
  if (profile.temperature_tier != null) {
    const parsed = temperatureTierSchema.safeParse(profile.temperature_tier);
    if (parsed.success) return parsed.data;
  }
  const fromCfg = temperatureTierSchema.safeParse(
    deps.engine.config.data.auto_llm?.subagent?.temperature_tier,
  );
  if (fromCfg.success) return fromCfg.data;
  return DEFAULT_SUBAGENT_TEMPERATURE_TIER;
}

function resolveMaxParallel(deps: FullRuntimeDeps): number {
  return Math.max(
    1,
    deps.engine.config.data.auto_llm?.subagent?.max_parallel ?? DEFAULT_SUBAGENT_MAX_PARALLEL,
  );
}

function resolveRunName(profile: ResolvedSubagentProfile, task: SubagentTaskInput): string {
  const title = task.title?.trim();
  if (title) return title;
  if (profile.kind === "ephemeral") {
    return profile.title.trim() || EPHEMERAL_SLUG;
  }
  return profile.slug;
}

/** 具名档案 或 临时（instructions + allowed_tools） */
export async function resolveSubagentProfile(
  worldId: number,
  task: SubagentTaskInput,
): Promise<ResolvedSubagentProfile> {
  const hasNamed =
    (task.id != null && Number.isFinite(task.id) && task.id > 0) || Boolean(task.slug?.trim());

  if (hasNamed) {
    let row = null;
    if (task.id != null && Number.isFinite(task.id) && task.id > 0) {
      row = await getSubagent(Math.floor(task.id));
      if (row && row.world_id !== worldId) row = null;
    } else {
      const slug = task.slug?.trim().toLowerCase();
      if (!slug) {
        throw new Error("subagent slug required");
      }
      row = await getSubagentBySlug(worldId, slug);
    }
    if (!row) {
      const { resolveProjectAgentOverlay } =
        await import("@freeanima/habitat/core/skill/project-overlay.ts");
      const slug = task.slug?.trim().toLowerCase() ?? "";
      const hit = slug
        ? await resolveProjectAgentOverlay(getToolConversationId() ?? null, slug)
        : null;
      if (hit) {
        return {
          kind: "ephemeral",
          id: null,
          slug: hit.slug,
          title: hit.slug,
          summary: hit.description,
          content: hit.content,
          skills: [],
          max_loop_iterations: null,
          temperature_tier: null,
          allowed_tools: hit.allowed_tools ?? [],
          denied_tools: [],
          prompt_includes: mergePromptIncludes(undefined, task.prompt_includes),
          world_id: worldId,
        };
      }
      throw new Error(
        task.id != null
          ? `subagent not found: id=${task.id}`
          : `subagent not found: slug=${task.slug}`,
      );
    }
    return {
      kind: "named",
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      content: row.content,
      skills: row.skills,
      max_loop_iterations: row.max_loop_iterations,
      temperature_tier: row.temperature_tier ?? null,
      allowed_tools: row.allowed_tools,
      denied_tools: row.denied_tools,
      prompt_includes: mergePromptIncludes(row.prompt_includes, task.prompt_includes),
      world_id: row.world_id,
    };
  }

  const instructions = task.instructions?.trim();
  if (!instructions) {
    throw new Error("ephemeral subagent requires instructions (or pass slug|id)");
  }
  if (task.allowed_tools == null) {
    throw new Error("ephemeral subagent requires allowed_tools (array; empty = no tools)");
  }
  return {
    kind: "ephemeral",
    id: null,
    slug: EPHEMERAL_SLUG,
    title: task.title?.trim() || "Ephemeral",
    summary: "",
    content: instructions,
    skills: task.skills ?? [],
    max_loop_iterations: task.max_loop_iterations ?? null,
    temperature_tier: task.temperature_tier ?? null,
    allowed_tools: task.allowed_tools,
    denied_tools: [],
    prompt_includes: mergePromptIncludes(task.prompt_includes),
    world_id: worldId,
  };
}

/** 子代理稳定任务规格（角色 / 目标分两条数据消息；不含 run 元数据） */
export const SUBAGENT_TASK_SPEC = `你是父代理派出的一次性子代理（slug={{slug}}）。
角色见角色层，本次目标见任务层。
只用已提供的工具；勿与用户闲聊、勿索取确认。
最后一轮输出给父代理的完整答复：结论、依据、未决问题；不要只写一句总结。`;

/**
 * 子代理角色 + opt-in 块（数据层，不进 task_spec）。
 */
export async function buildSubagentRoleData(
  profile: ResolvedSubagentProfile,
  agent: { agent_subject_id: number; agent_world_id: number },
): Promise<string> {
  const optIn = await buildSubagentOptInSections(profile.prompt_includes, agent);
  const role = formatSubagentRoleSection(profile);
  return [role, ...optIn].filter(Boolean).join("\n\n");
}

/** @deprecated 使用 SUBAGENT_TASK_SPEC + buildSubagentRoleData */
export async function buildSubagentTaskSpec(
  profile: ResolvedSubagentProfile,
  agent: { agent_subject_id: number; agent_world_id: number },
): Promise<string> {
  const roleData = await buildSubagentRoleData(profile, agent);
  return [SUBAGENT_TASK_SPEC, roleData].filter(Boolean).join("\n\n");
}

/** @deprecated 使用 composeAutoLlmPrompt + SUBAGENT_TASK_SPEC */
export async function buildSubagentSystemPrompt(
  _deps: FullRuntimeDeps,
  profile: ResolvedSubagentProfile,
  _functionNames: string[],
): Promise<string> {
  const { systemPrompt } = composeAutoLlmPrompt({
    kind: "subagent",
    taskSpec: SUBAGENT_TASK_SPEC,
    taskParams: { slug: profile.slug },
  });
  return systemPrompt;
}

async function runOneTask(
  deps: FullRuntimeDeps,
  worldId: number,
  task: SubagentTaskInput,
  parentConversationId: string | undefined,
  onLiveUpdate: (slot: SubagentLiveSlot) => void,
): Promise<SubagentRunTaskResult> {
  const profile = await resolveSubagentProfile(worldId, task);
  const skillNames = [...new Set([...profile.skills, ...(task.skills ?? [])])];
  const skillFrags = skillPolicyFragments(deps.engine.skills, skillNames);
  const skillDenies = skillFrags.flatMap((f) => [...f.denied_tools]);

  const policy = resolveSubagentToolPolicy(
    {
      entityAllowed: profile.allowed_tools,
      entityDenied: profile.denied_tools,
      skillDenies,
      callExtraDenied: task.denied_tools ?? [],
      hardDeny: [...SUBAGENT_HARD_DENY_TOOLS],
    },
    deps.engine.catalog.toolSets,
  );
  const toolNames = materializeToolNames(policy, [...SUBAGENT_HARD_DENY_TOOLS]);

  const goalBlock = formatSubagentGoalSection({
    slug: profile.slug,
    goal: task.goal,
    ...omitUndefined({ context: task.context }),
  });

  const skillsText = formatSkillsPrefix(deps.engine.skills, skillNames);
  if (!parentConversationId?.trim()) {
    throw new Error("subagent requires parent conversation to resolve acting subject");
  }
  const bound = await resolveBoundAgentForConversation(parentConversationId);
  const roleData = await buildSubagentRoleData(profile, {
    agent_subject_id: bound.agent_subject_id,
    agent_world_id: bound.agent_world_id,
  });
  const { systemPrompt, userMessages } = composeAutoLlmPrompt({
    kind: "subagent",
    taskSpec: SUBAGENT_TASK_SPEC,
    taskParams: { slug: profile.slug },
    skillsText: skillsText || null,
    dataParts: [
      ...(roleData.trim() ? [{ tag: PROMPT_XML_TAGS.subagentRole, body: roleData }] : []),
      { tag: PROMPT_XML_TAGS.subagentGoal, body: goalBlock },
    ],
  });

  const maxLoopIterations = resolveMaxLoopIterations(deps, profile, task.max_loop_iterations);
  const tier = resolveTemperatureTier(deps, profile, task.temperature_tier);
  const model = getProfileHopModel(deps.engine.config.data, PROFILE_CHAT);
  const format = getProfileHopFormat(deps.engine.config.data, PROFILE_CHAT);
  const requestParams = temperatureTierToCallParams(
    tier,
    resolveSamplingRanges(format, model),
    omitUndefined({ format }),
  );
  const runName = resolveRunName(profile, task);

  const liveBase: SubagentLiveSlot = {
    run_id: "",
    slug: profile.slug,
    subagent_entity_id: profile.id ?? 0,
    status: "running",
    output: "",
    tool_calls: 0,
    steps: [],
    duration_ms: 0,
  };
  onLiveUpdate(liveBase);

  const subjectId = bound.agent_subject_id;

  const result: AutoLlmRunResult = await runAutoLlm(
    deps,
    omitUndefined({
      runName,
      runKind: "subagent",
      subjectId,
      systemPrompt,
      userMessages,
      model,
      toolNames,
      maxLoopIterations,
      maxDurationMs: AUTO_LLM_DEFAULT_MAX_DURATION_MS,
      requestParams,
      toolPolicy: policy,
      parentConversationId,
      metadata: {
        subagent_entity_id: profile.id,
        slug: profile.slug,
        kind: profile.kind,
        world_id: worldId,
        temperature_tier: tier,
      },
      onStep: (steps: readonly AutoLlmToolStep[]) => {
        onLiveUpdate({
          ...liveBase,
          tool_calls: steps.length,
          steps: steps.map((s) => ({ ...s })),
        });
      },
    }),
  );

  return omitUndefined({
    run_id: result.runId,
    slug: profile.slug,
    subagent_entity_id: profile.id ?? 0,
    status: result.status,
    output: result.output,
    tool_calls: result.toolCalls,
    steps: result.steps,
    error: result.error,
    duration_ms: result.durationMs,
  });
}

/** 顺序/并行执行多个 subagent 任务；单槽失败不取消兄弟。 */
export async function runSubagentTasks(
  deps: FullRuntimeDeps,
  input: {
    worldId: number;
    tasks: SubagentTaskInput[];
    parentConversationId?: string;
  },
): Promise<{ results: SubagentRunTaskResult[] }> {
  if (input.tasks.length === 0) {
    throw new Error("tasks must be non-empty");
  }
  const maxParallel = resolveMaxParallel(deps);
  const parentConversationId = input.parentConversationId ?? getToolConversationId() ?? undefined;

  const results: SubagentRunTaskResult[] = Array.from({ length: input.tasks.length });
  const liveSlots: Array<SubagentLiveSlot | undefined> = Array.from({
    length: input.tasks.length,
  });
  let cursor = 0;

  const bumpProgress = (): void => {
    publishSubagentProgress(liveSlots, input.tasks);
  };

  async function worker(): Promise<void> {
    while (true) {
      const idx = cursor;
      cursor += 1;
      if (idx >= input.tasks.length) return;
      const task = input.tasks[idx];
      if (!task) return;
      try {
        results[idx] = await runOneTask(deps, input.worldId, task, parentConversationId, (slot) => {
          liveSlots[idx] = slot;
          bumpProgress();
        });
        const final = results[idx];
        if (final) {
          liveSlots[idx] = omitUndefined({
            run_id: final.run_id,
            slug: final.slug,
            subagent_entity_id: final.subagent_entity_id,
            status: final.status,
            output: final.output,
            tool_calls: final.tool_calls,
            steps: final.steps,
            error: final.error,
            duration_ms: final.duration_ms,
          });
          bumpProgress();
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results[idx] = {
          run_id: "",
          slug: task.slug?.trim() || EPHEMERAL_SLUG,
          subagent_entity_id: task.id ?? 0,
          status: "error",
          output: "",
          tool_calls: 0,
          error: msg,
          duration_ms: 0,
        };
        liveSlots[idx] = {
          run_id: "",
          slug: results[idx].slug,
          subagent_entity_id: results[idx].subagent_entity_id,
          status: "error",
          output: "",
          tool_calls: 0,
          error: msg,
          duration_ms: 0,
        };
        bumpProgress();
      }
    }
  }

  const workers = Array.from({ length: Math.min(maxParallel, input.tasks.length) }, () => worker());
  await Promise.all(workers);
  return { results };
}
