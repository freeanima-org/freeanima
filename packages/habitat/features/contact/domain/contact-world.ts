import { getResolvedWorldContext } from "@freeanima/habitat/core/config";
import { assertSubjectCanAccessWorld } from "@freeanima/habitat/core/db/pg/entity";

/** 通讯录固定落在 Commons world。 */
export function resolveContactWorldId(): number {
  return getResolvedWorldContext().commons_world_id;
}

/** 校验主体对 Commons 的访问；user 经全局规则对任意 world 满权限。 */
export async function assertContactWorldAccess(opts: {
  subjectId: number;
  subjectType: string | undefined;
  access: "read" | "write";
}): Promise<number> {
  void opts.subjectType;
  const worldId = resolveContactWorldId();
  await assertSubjectCanAccessWorld(opts.subjectId, worldId, { access: opts.access });
  return worldId;
}
