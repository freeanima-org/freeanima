import { prependSkillsToPrompt, skillPolicyFragments } from "@freeanima/host/core/skill";
import { getProfileHopModel } from "@freeanima/host/platform/config";
import { PROFILE_CHAT } from "@freeanima/host/core/provider";
import {
  resolveDefaultConversationToolSets,
  toolNamesForToolSets,
} from "@freeanima/host/core/tool";
import { omitUndefined } from "@freeanima/host/core/util";
import {
  filterToolNamesByPolicy,
  resolveInvisibleCapabilityPolicy,
} from "../capability-policy-bind.ts";

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
  const toolSetNames = resolveDefaultConversationToolSets(deps.engine.catalog.toolSets);
  const allToolNames = toolNamesForToolSets(deps.engine.catalog.toolSets, toolSetNames);

  const skillFrags = skillPolicyFragments(deps.engine.skills, job.skills);
  const policy = resolveInvisibleCapabilityPolicy(deps.engine.catalog.toolSets, {
    skills: skillFrags,
    caller: {
      allowed_tools: job.allowed_tools ?? [],
      denied_tools: job.denied_tools ?? [],
    },
  });
  // 看不见场景：若技能+调用方均无 allow，则空列表（最小权限）；否则按策略过滤默认工具池
  const toolNames =
    policy.allowed_tools.length > 0
      ? filterToolNamesByPolicy(allToolNames, policy)
      : skillFrags.length === 0 && !job.allowed_tools?.length
        ? allToolNames
        : [];

  const maxTurns = cfg.compression?.max_rounds ?? 50;

  const result = await runAutoLlm(
    deps,
    omitUndefined({
      runName,
      runKind: "cron",
      systemPrompt,
      userMessages: [fullPrompt],
      model,
      toolNames,
      maxTurns,
      toolMask: policy.allowed_tools.length > 0 ? policy : undefined,
      metadata: job.id ? { job_id: job.id } : undefined,
    }),
  );

  if (result.status === "error") {
    return `[engine error] ${result.error ?? result.output}`;
  }
  return result.output;
}
