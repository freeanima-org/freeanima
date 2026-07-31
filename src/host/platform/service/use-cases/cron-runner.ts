import { prependSkillsToPrompt, skillPolicyFragments } from "@freeanima/host/core/skill";
import { getProfileHopModel } from "@freeanima/host/platform/config";
import { getResolvedWorldContext } from "@freeanima/host/core/config/world-context";
import { PROFILE_CHAT } from "@freeanima/host/core/provider";
import { omitUndefined } from "@freeanima/host/core/util";
import {
  filterToolNamesByPolicy,
  type ResolvedCapabilityPolicy,
} from "@freeanima/host/core/capability-policy";
import { materializeFromFragments } from "../capability-policy-bind.ts";

import type { FullRuntimeDeps } from "../runtime-deps.ts";
import {
  buildAutoLlmSystemPrompt,
  formatCronAutoLlmTaskSection,
} from "../build-auto-llm-prompt.ts";
import { runAutoLlm } from "../auto-llm-run.ts";

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
  const fullPrompt = prependSkillsToPrompt(deps.engine.skills, prompt, job.skills);
  const runName = job.name?.trim() || job.id?.trim() || "cron";
  const systemPrompt = await buildAutoLlmSystemPrompt({
    taskSection: formatCronAutoLlmTaskSection(runName),
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

  const maxTurns = cfg.compression?.max_rounds ?? 50;

  const result = await runAutoLlm(
    deps,
    omitUndefined({
      runName,
      runKind: "cron",
      subjectId: getResolvedWorldContext().agent_subject_id,
      systemPrompt,
      userMessages: [fullPrompt],
      model,
      toolNames,
      maxTurns,
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
