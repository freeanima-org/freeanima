import { resolvePrivateWorldId } from "@freeanima/habitat/core/config/world-context-pg";
import { resolveToolCallerSubjectId } from "@freeanima/habitat/core/tool";

/** 记忆砖块写入当前工具/会话 subject 的私有 world；无上下文则报错（禁止回退默认 agent） */
export async function resolveMemoryBrickWorldId(subjectId?: number): Promise<number> {
  if (subjectId != null && subjectId > 0) {
    return resolvePrivateWorldId(subjectId);
  }
  return resolvePrivateWorldId(resolveToolCallerSubjectId());
}
