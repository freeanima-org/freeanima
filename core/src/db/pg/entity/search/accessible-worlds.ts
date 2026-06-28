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
