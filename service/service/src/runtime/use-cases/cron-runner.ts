import * as conv from "@freeanima/engine-conversation";
import { prependSkillsToPrompt } from "@freeanima/engine-skill";
import { getProfileHopModel, loadConfig } from "@freeanima/service-config";
import { PROFILE_CHAT } from "@freeanima/engine-provider-llm";
import { runSimpleTurn } from "@freeanima/service-api/turn-lifecycle";

import { getServiceContext } from "../../context.ts";

export type CronEngineJobInput = {
  model_name?: string | null;
  skills: string[];
};

export async function runCronEngineTurn(job: CronEngineJobInput, prompt: string): Promise<string> {
  const { conversation, engine } = getServiceContext();
  const cfg = loadConfig();
  const model = job.model_name ?? getProfileHopModel(cfg, PROFILE_CHAT);
  const sid = conv.generateSessionId();
  await conversation.initSession(sid, model, { platform: "cron" });

  const fullPrompt = prependSkillsToPrompt(engine.skills, prompt, job.skills);

  return runSimpleTurn({ sessionId: sid, prompt: fullPrompt, model });
}
