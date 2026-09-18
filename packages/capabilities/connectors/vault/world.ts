import { resolvePrivateWorldId } from "@freeanima/core/config/world-context-pg";

/** 保险库所在 world = 该 subject 的私有 world（能力层实现，特性层仅再导出）。 */
export async function resolveVaultWorldId(subjectId: number): Promise<number> {
  return resolvePrivateWorldId(subjectId);
}
