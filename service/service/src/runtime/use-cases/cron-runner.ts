import * as conv from "@freeanima/runtime/conversation";
import { prependSkillsToPrompt } from "@freeanima/mechanism-skill";
import { getProfileHopModel } from "@freeanima/service-config";
import { PROFILE_CHAT } from "@freeanima/storage-provider-llm";
import { runSimpleTurn } from "../turn-lifecycle.ts";
import type { FullRuntimeDeps } from "../runtime-deps.ts";

export type CronEngineJobInput = {
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
  const sid = conv.generateSessionId();
  await deps.conversation.initSession(sid, model, { platform: "cron" });

  const fullPrompt = prependSkillsToPrompt(deps.engine.skills, prompt, job.skills);

  return runSimpleTurn(deps, { sessionId: sid, prompt: fullPrompt, model });
}
