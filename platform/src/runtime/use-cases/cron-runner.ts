import { prependSkillsToPrompt } from "@freeanima/core/skill";
import { getProfileHopModel } from "@freeanima/platform/config";
import { PROFILE_CHAT } from "@freeanima/core/provider";
import { resolveDefaultSessionToolSets, toolNamesForToolSets } from "@freeanima/core/tool";

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
  const toolSetNames = resolveDefaultSessionToolSets(deps.engine.catalog.toolSets);
  const toolNames = toolNamesForToolSets(deps.engine.catalog.toolSets, toolSetNames);
  const maxTurns = cfg.compression?.max_rounds ?? 50;

  const result = await runAutoLlm(deps, {
    runName,
    runKind: "cron",
    systemPrompt,
    userMessages: [fullPrompt],
    model,
    toolNames,
    maxTurns,
    metadata: job.id ? { job_id: job.id } : undefined,
  });

  if (result.status === "error") {
    return `[engine error] ${result.error ?? result.output}`;
  }
  return result.output;
}
