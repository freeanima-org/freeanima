import { resolvePrivateWorldId } from "@freeanima/core/config/world-context-pg";

export async function resolveVaultWorldId(subjectId: number): Promise<number> {
  return resolvePrivateWorldId(subjectId);
}
