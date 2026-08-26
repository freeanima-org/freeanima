import { getResolvedWorldContext } from "@freeanima/habitat/core/config";
import { updateEntity } from "@freeanima/habitat/core/db/pg/entity";
import { CODING_CATALOG_TAG_TITLE } from "@freeanima/habitat/core/hooks/prompt";
import { ensureTagsByTitles } from "@freeanima/features/tag/domain";

import { BUILTIN_SUBAGENT_SEEDS } from "./builtin-seeds.ts";
import { createSubagent, getSubagentBySlug } from "./subagent-store.ts";

export { BUILTIN_SUBAGENT_SEEDS } from "./builtin-seeds.ts";

const CODING_TAGGED_SLUGS = new Set(["coding-explorer"]);

/** 为内置 coding subagent 挂上 entity 标签 `coding`（幂等） */
export async function ensureBuiltinSubagentCatalogTags(worldId: number): Promise<void> {
  const codingTagIds = await ensureTagsByTitles(worldId, [CODING_CATALOG_TAG_TITLE]);
  const codingTagId = codingTagIds[0];
  if (codingTagId == null) return;

  for (const slug of CODING_TAGGED_SLUGS) {
    const row = await getSubagentBySlug(worldId, slug);
    if (!row) continue;
    if (row.tag_ids.includes(codingTagId)) continue;
    await updateEntity({
      id: row.id,
      tag_ids: [...new Set([...row.tag_ids, codingTagId])],
    });
  }
}

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
  await ensureBuiltinSubagentCatalogTags(worldId);
  return seeded;
}
