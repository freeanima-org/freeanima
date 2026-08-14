import { worldConfigBodySchema } from "@freeanima/habitat/core/db/schema";
import type { EntityListOpts } from "../types.ts";
import type { EntityRow } from "@freeanima/habitat/core/db/schema/entity";
import { accessLevelMeets, subjectWorldAccessLevel } from "../subject-world-access.ts";

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

/** subject 可访问（至少 read）的 world：public + owned private + grants */
export async function resolveWorldsAccessibleBySubject(
  store: EntityWorldListStore,
  subjectId: number,
): Promise<number[]> {
  const worlds = await store.list({ type: "world", limit: 500 });
  const ids: number[] = [];
  for (const row of worlds) {
    const level = subjectWorldAccessLevel(row.body ?? {}, subjectId);
    if (accessLevelMeets(level, "read")) {
      ids.push(row.id);
    }
  }
  return ids;
}
