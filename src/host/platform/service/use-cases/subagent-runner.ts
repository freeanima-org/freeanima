import { prependSkillsToPrompt, skillPolicyFragments } from "@freeanima/host/core/skill";
import {
  resolveSubagentToolPolicy,
  materializeToolNames,
} from "@freeanima/host/core/capability-policy";
import {
  DEFAULT_SYSTEM_PROMPT_BUDGET_CHARS,
  getProfileHopModel,
  peekActiveRuntimeConfig,
} from "@freeanima/host/core/config";
import { getResolvedWorldContext } from "@freeanima/host/core/config/world-context";
import { PROFILE_CHAT } from "@freeanima/host/core/provider";
import { omitUndefined } from "@freeanima/host/core/util";
import { getToolConversationId, reportToolProgress, toolResult } from "@freeanima/host/core/tool";
import {
  foldSystemPromptSectionsDetailed,
  systemPromptBuild,
} from "@freeanima/host/core/hooks/prompt";

import { runAutoLlm, type AutoLlmRunResult, type AutoLlmToolStep } from "../auto-llm-run.ts";
import type { FullRuntimeDeps } from "../runtime-deps.ts";
import { notifyPromptFoldBudgetSoftFailure } from "../prompt-fold-soft-failure-notify.ts";
import {
  getSubagent,
  getSubagentBySlug,
} from "@freeanima/features/subagent/domain/subagent-store.ts";
import {
  buildSubagentOptInSections,
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

const DEFAULT_SUBAGENT_MAX_TURNS = 20;
const DEFAULT_SUBAGENT_MAX_PARALLEL = 4;
const EPHEMERAL_SLUG = "ephemeral";

export type SubagentRunTaskResult = {
  run_id: string;
  slug: string;
  subagent_entity_id: number;
  status: "ok" | "error";
  output: string;
  tool_calls: number;
  steps?: Array<{ name: string; title?: string; status: string }>;
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
    return {
      run_id: "",
      slug: task?.slug?.trim() || EPHEMERAL_SLUG,
      subagent_entity_id: task?.id ?? 0,
      status: "running" as const,
      output: "",
      tool_calls: 0,
      steps: [] as AutoLlmToolStep[],
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

function resolveMaxTurns(
  deps: FullRuntimeDeps,
  profile: ResolvedSubagentProfile,
  override?: number,
): number {
  if (override != null && override > 0) return override;
  if (profile.max_turns != null && profile.max_turns > 0) return profile.max_turns;
  const cfg = deps.engine.config.data.auto_llm as { subagent?: { max_turns?: number } } | undefined;
  return cfg?.subagent?.max_turns ?? DEFAULT_SUBAGENT_MAX_TURNS;
}

function resolveMaxParallel(deps: FullRuntimeDeps): number {
  const cfg = deps.engine.config.data.auto_llm as
    | { subagent?: { max_parallel?: number } }
    | undefined;
  return Math.max(1, cfg?.subagent?.max_parallel ?? DEFAULT_SUBAGENT_MAX_PARALLEL);
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
        await import("@freeanima/host/core/skill/project-overlay.ts");
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
          max_turns: null,
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
      max_turns: row.max_turns,
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
    max_turns: task.max_turns ?? null,
    allowed_tools: task.allowed_tools,
    denied_tools: [],
    prompt_includes: mergePromptIncludes(task.prompt_includes),
    world_id: worldId,
  };
}

/**
 * 子提示词路径（与对话分离）：
 * 1. systemPromptBuild(llm_kind=auto_llm) — 仅 auto_llm/all 注册的 hooks
 * 2. opt-in 旁路（self/world/time）— 档案与调用并集，默认空
 * 3. 角色段（具名 content / 临时 instructions）
 */
export async function buildSubagentSystemPrompt(
  deps: FullRuntimeDeps,
  profile: ResolvedSubagentProfile,
  functionNames: string[],
): Promise<string> {
  let hookText = "";
  try {
    const run = await deps.kernel.hookRegistry.run(
      systemPromptBuild,
      { functionNames, mode: "work" },
      { llm_kind: "auto_llm" },
    );
    const budget =
      peekActiveRuntimeConfig()?.data.prompt?.system_prompt_budget_chars ??
      DEFAULT_SYSTEM_PROMPT_BUDGET_CHARS;
    const folded = foldSystemPromptSectionsDetailed(run.chain, { globalBudgetChars: budget });
    void notifyPromptFoldBudgetSoftFailure(folded);
    hookText = folded.text.trim();
  } catch {
    hookText = "";
  }
  const optIn = await buildSubagentOptInSections(profile.prompt_includes);
  const role = formatSubagentRoleSection(profile);
  return [hookText, ...optIn, role].filter(Boolean).join("\n\n");
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

  const goalBlock = [
    `## Subagent task (${profile.slug})`,
    task.goal.trim(),
    task.context?.trim() ? `\n## Context\n${task.context.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const withSkills = prependSkillsToPrompt(deps.engine.skills, goalBlock, skillNames);
  const systemPrompt = await buildSubagentSystemPrompt(deps, profile, toolNames);

  const maxTurns = resolveMaxTurns(deps, profile, task.max_turns);
  const model = getProfileHopModel(deps.engine.config.data, PROFILE_CHAT);
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

  const result: AutoLlmRunResult = await runAutoLlm(
    deps,
    omitUndefined({
      runName,
      runKind: "subagent",
      subjectId: getResolvedWorldContext().agent_subject_id,
      systemPrompt,
      userMessages: [withSkills],
      model,
      toolNames,
      maxTurns,
      toolPolicy: policy,
      parentConversationId,
      metadata: {
        subagent_entity_id: profile.id,
        slug: profile.slug,
        kind: profile.kind,
        world_id: worldId,
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
            steps: final.steps as AutoLlmToolStep[] | undefined,
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
