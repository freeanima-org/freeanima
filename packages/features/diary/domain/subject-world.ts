import { resolvePrivateWorldId } from "@freeanima/core/config/world-context-pg";

export async function resolveDiaryWorldId(subjectId: number): Promise<number> {
  return resolvePrivateWorldId(subjectId);
}
