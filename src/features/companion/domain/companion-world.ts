import { resolveSubjectWorldId } from "@freeanima/host/core/config";

/**
 * 伴侣引用的 object_file 落在 User 私有 world（人侧资产；不会随 agent/项目 world 清库）。
 */
export function resolveCompanionWorldId(): number {
  return resolveSubjectWorldId("user");
}
