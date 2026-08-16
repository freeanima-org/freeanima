import { formatSkillsPrefix, skillPolicyFragments } from "@freeanima/habitat/core/skill";
import { getProfileHopModel } from "@freeanima/habitat/platform/config";
import { getResolvedWorldContext } from "@freeanima/habitat/core/config/world-context";
import { PROFILE_CHAT } from "@freeanima/habitat/core/provider";
import { omitUndefined } from "@freeanima/habitat/core/util";
import {
  filterToolNamesByPolicy,
  type ResolvedCapabilityPolicy,
} from "@freeanima/habitat/core/capability-policy";
import { materializeFromFragments } from "../capability-policy-bind.ts";

import type { FullRuntimeDeps } from "../runtime-deps.ts";
import { composeAutoLlmPrompt, formatCronAutoLlmTaskSpec } from "../build-auto-llm-prompt.ts";
import { AUTO_LLM_DEFAULT_MAX_DURATION_MS, runAutoLlm } from "../auto-llm-run.ts";

export type CronEngineJobInput = {
  id?: string;
  name?: string;
  model_name?: string | null;
  skills: string[];
  allowed_tools?: string[];
  denied_tools?: string[];
};

/**
 * 看不见场景：无 allow → 空列表（默认禁止全部工具）；
 * 有 allow → 与默认工具池求交。
 */
export function toolNamesForInvisiblePolicy(
  pool: readonly string[],
  policy: ResolvedCapabilityPolicy,
): string[] {
  if (policy.allowed_tools.length === 0) return [];
  return filterToolNamesByPolicy(pool, policy);
}

export async function runCronEngineTurn(
  deps: FullRuntimeDeps,
  job: CronEngineJobInput,
  prompt: string,
): Promise<string> {
  const cfg = deps.engine.config.data;
  const model = job.model_name ?? getProfileHopModel(cfg, PROFILE_CHAT);
  const runName = job.name?.trim() || job.id?.trim() || "cron";
  const skillsText = formatSkillsPrefix(deps.engine.skills, job.skills);
  const { systemPrompt, userMessages } = composeAutoLlmPrompt({
    kind: "cron",
    taskSpec: formatCronAutoLlmTaskSpec(),
    skillsText: skillsText || null,
    dataParts: [{ body: prompt }],
  });

  const skillFrags = skillPolicyFragments(deps.engine.skills, job.skills);
  const { policy, toolNames } = materializeFromFragments(
    [
      ...skillFrags,
      {
        allowed_tools: job.allowed_tools ?? [],
        denied_tools: job.denied_tools ?? [],
      },
    ],
    deps.engine.catalog.toolSets,
  );

  const maxLoopIterations = 50;

  const result = await runAutoLlm(
    deps,
    omitUndefined({
      runName,
      runKind: "cron",
      subjectId: getResolvedWorldContext().agent_subject_id,
      systemPrompt,
      userMessages,
      model,
      toolNames,
      maxLoopIterations,
      maxDurationMs: AUTO_LLM_DEFAULT_MAX_DURATION_MS,
      // 始终传执行闸（含空 allow = 全禁）
      toolPolicy: policy,
      metadata: job.id ? { job_id: job.id } : undefined,
    }),
  );

  if (result.status === "error") {
    return `[engine error] ${result.error ?? result.output}`;
  }
  return result.output;
}
