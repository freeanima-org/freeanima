import { getResolvedWorldContext } from "@freeanima/habitat/core/config";

import { BUILTIN_SUBAGENT_SEEDS } from "./builtin-seeds.ts";
import { createSubagent, getSubagentBySlug } from "./subagent-store.ts";

export { BUILTIN_SUBAGENT_SEEDS } from "./builtin-seeds.ts";

/** 幂等种子内置 subagent 到 agent 私有 world */
export async function seedBuiltinSubagents(): Promise<number> {
  const worldId = getResolvedWorldContext().agent_world_id;
  let seeded = 0;
  for (const def of BUILTIN_SUBAGENT_SEEDS) {
    const existing = await getSubagentBySlug(worldId, def.slug);
    if (existing) continue;
    await createSubagent(worldId, def);
    seeded += 1;
  }
  return seeded;
}
