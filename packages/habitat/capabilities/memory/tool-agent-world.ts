import { resolvePrivateWorldId } from "@freeanima/habitat/core/config/world-context-pg.ts";
import { resolveToolCallerSubjectId } from "@freeanima/habitat/core/tool/tool-context.ts";
import type { SemanticMemoryRow } from "@freeanima/habitat/core/db/pg/semantic-memory/types";

/** 当前工具上下文的 acting agent → 私有 world（禁止回退默认聊天 agent） */
export async function resolveToolCallerAgentWorldId(): Promise<{
  agent_subject_id: number;
  agent_world_id: number;
}> {
  const agent_subject_id = resolveToolCallerSubjectId();
  const agent_world_id = await resolvePrivateWorldId(agent_subject_id);
  return { agent_subject_id, agent_world_id };
}

/** 校验记忆行属于当前工具 caller 的私有 world */
export function assertSemanticMemoryInWorld(
  row: Pick<SemanticMemoryRow, "id" | "world_id">,
  worldId: number,
): string | null {
  if (row.world_id !== worldId) {
    return `Memory not found: ${row.id}`;
  }
  return null;
}
