import { resolveSubjectWorldId, getResolvedWorldContext } from "@freeanima/host/core/config";

/**
 * 伴侣引用的 object_file 落在 Commons world（共享模型 / 动作库）。
 * 历史落在 user private 的条目不迁移；需重新上传。
 */
export function resolveCompanionWorldId(): number {
  return getResolvedWorldContext().commons_world_id;
}

/** @deprecated 保留给需明确 user world 的调用方 */
export function resolveCompanionUserWorldId(): number {
  return resolveSubjectWorldId("user");
}
