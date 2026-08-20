import { getResolvedWorldContext } from "@freeanima/habitat/core/config";
import { assertSubjectCanAccessWorld } from "@freeanima/habitat/core/db/pg/entity";

/** 通讯录固定落在 Commons world。 */
export function resolveContactWorldId(): number {
  return getResolvedWorldContext().commons_world_id;
}

/**
 * 壳侧 user（主人）维护 Commons 通讯录免 grant 校验（与伴侣资源写入 Commons 同惯例）。
 * agent 仍须对 Commons 有对应 read/write grant。不改动全局 subject-world-access。
 */
export function isContactUserAccessPassthrough(subjectType: string | undefined): boolean {
  return subjectType === "user";
}

export async function assertContactWorldAccess(opts: {
  subjectId: number;
  subjectType: string | undefined;
  access: "read" | "write";
}): Promise<number> {
  const worldId = resolveContactWorldId();
  if (isContactUserAccessPassthrough(opts.subjectType)) {
    return worldId;
  }
  await assertSubjectCanAccessWorld(opts.subjectId, worldId, { access: opts.access });
  return worldId;
}
