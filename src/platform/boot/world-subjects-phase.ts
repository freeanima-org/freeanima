import type { RuntimeConfigStore } from "@freeanima/platform/config";
import { resolveAndBindWorldContext } from "@freeanima/core/config/world-context";

import { startupLog } from "./status.ts";

export type WorldSubjectsPhaseResult = Record<string, never>;

/** Phase 2.5: 确保 user/agent subject 与默认私有 world（迁移后、engine 前） */
export async function bootWorldSubjectsPhase(
  config: RuntimeConfigStore,
): Promise<WorldSubjectsPhaseResult> {
  startupLog("Ensuring world subjects…");
  const ctx = await resolveAndBindWorldContext(config.data);
  startupLog(
    `World subjects ready (user=${ctx.user_subject_id}/world=${ctx.user_world_id}, agent=${ctx.agent_subject_id}/world=${ctx.agent_world_id})`,
  );
  return {};
}
