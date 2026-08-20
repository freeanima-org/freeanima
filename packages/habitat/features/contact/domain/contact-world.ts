import { getResolvedWorldContext } from "@freeanima/habitat/core/config";

/** 通讯录固定落在 Commons world。 */
export function resolveContactWorldId(): number {
  return getResolvedWorldContext().commons_world_id;
}
