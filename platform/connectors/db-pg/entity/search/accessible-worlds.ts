import { worldConfigBodySchema } from "@freeanima/core/db/schema";
import type { EntityStorePort } from "@freeanima/core/repos";

/** 全局搜索可访问的 public world id 列表（private world 排除） */
export async function resolvePublicAccessibleWorldIds(store: EntityStorePort): Promise<number[]> {
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
