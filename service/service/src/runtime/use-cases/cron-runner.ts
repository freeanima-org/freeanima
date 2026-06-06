import { existsSync } from "node:fs";
import * as conv from "@freeanima/engine-conversation";
import { distillFromPg, l2SessionPath } from "@freeanima/life-memory/clean";
import { indexL2Session } from "@freeanima/life-memory/l2-indexer";
import { loadSkill } from "@freeanima/life-memory";
import { getProfileHopModel, loadConfig } from "@freeanima/service-config";
import { PROFILE_CHAT } from "@freeanima/engine-provider-llm";
import { runSimpleTurn } from "@freeanima/service-api/turn-lifecycle";

import { getServiceContext } from "../../context.ts";

export type CronEngineJobInput = {
  model_name?: string | null;
  skills: string[];
};

export async function runCronL2GapFill(): Promise<string> {
  const { conversation } = getServiceContext();
  let count = 0;
  const sessionStore = conversation.repos.session;
  for (const sid of await conversation.listSessions()) {
    if (existsSync(l2SessionPath(sid))) continue;
    const result = await distillFromPg(sessionStore, sid);
    if (result) {
      count += 1;
      indexL2Session(sid);
    }
  }
  return count ? `L2 gap-fill: ${count} session(s) distilled and indexed` : "";
}

export async function runCronEngineTurn(job: CronEngineJobInput, prompt: string): Promise<string> {
  const { conversation } = getServiceContext();
  const cfg = loadConfig();
  const model = job.model_name ?? getProfileHopModel(cfg, PROFILE_CHAT);
  const sid = conv.generateSessionId();
  await conversation.initSession(sid, model, { platform: "cron" });

  for (const skillName of job.skills) {
    loadSkill(skillName);
  }

  return runSimpleTurn({ sessionId: sid, prompt, model });
}
