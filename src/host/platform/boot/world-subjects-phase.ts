import type { RuntimeConfigStore } from "@freeanima/host/platform/config";
import { resolveAndBindWorldContext } from "@freeanima/host/core/config/world-context";

import { startupLog } from "./status.ts";

export type WorldSubjectsPhaseResult = Record<string, never>;

/** 与 habitat_runtime_config.worlds 段比对（不含 legacy notifications 伪装） */
function worldsSectionNeedsPersist(
  worlds:
    | { user_subject_id?: number | undefined; agent_subject_id?: number | undefined }
    | undefined,
  resolved: { user_subject_id: number; agent_subject_id: number },
): boolean {
  return (
    worlds?.user_subject_id !== resolved.user_subject_id ||
    worlds?.agent_subject_id !== resolved.agent_subject_id
  );
}

/** Phase 2.5: 确保 user/agent subject 与默认私有 world（迁移后、engine 前）；必要时回写 worlds */
export async function bootWorldSubjectsPhase(
  config: RuntimeConfigStore,
): Promise<WorldSubjectsPhaseResult> {
  startupLog("Ensuring world subjects…");
  const ctx = await resolveAndBindWorldContext(config.data);

  if (
    worldsSectionNeedsPersist(config.data.worlds, {
      user_subject_id: ctx.user_subject_id,
      agent_subject_id: ctx.agent_subject_id,
    })
  ) {
    await config.patchSection("worlds", {
      user_subject_id: ctx.user_subject_id,
      agent_subject_id: ctx.agent_subject_id,
    });
    startupLog(
      `Persisted worlds subject ids (user=${ctx.user_subject_id}, agent=${ctx.agent_subject_id})`,
    );
  }

  startupLog(
    `World subjects ready (user=${ctx.user_subject_id}/world=${ctx.user_world_id}, agent=${ctx.agent_subject_id}/world=${ctx.agent_world_id}, commons=${ctx.commons_world_id})`,
  );
  return {};
}
