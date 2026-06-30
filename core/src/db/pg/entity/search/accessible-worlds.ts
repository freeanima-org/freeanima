import { worldConfigBodySchema } from "@freeanima/core/db/schema";
import type { EntityListOpts } from "../types.ts";
import type { EntityRow } from "@freeanima/core/db/schema/entity";

type EntityWorldListStore = {
  list(opts?: EntityListOpts): Promise<EntityRow[]>;
};

/** 全局搜索可访问的 public world id 列表（private world 排除） */
export async function resolvePublicAccessibleWorldIds(
  store: EntityWorldListStore,
): Promise<number[]> {
  const worlds = await store.list({ type: "world", limit: 500 });
  const ids: number[] = [];
  for (const row of worlds) {
    const parsed = worldConfigBodySchema.safeParse(row.body);
    if (!parsed.success || !parsed.data.private) {
      ids.push(row.id);
    }
  }
  return ids;
}

/** subject 可访问的 world：public + 该 subject 拥有的 private world */
export async function resolveWorldsAccessibleBySubject(
  store: EntityWorldListStore,
  subjectId: number,
): Promise<number[]> {
  const worlds = await store.list({ type: "world", limit: 500 });
  const ids: number[] = [];
  for (const row of worlds) {
    const parsed = worldConfigBodySchema.safeParse(row.body);
    if (!parsed.success) continue;
    if (!parsed.data.private) {
      ids.push(row.id);
      continue;
    }
    if (parsed.data.owner_subject_id === subjectId) {
      ids.push(row.id);
    }
  }
  return ids;
}
