import { resolvePrivateWorldId } from "@freeanima/habitat/core/config/world-context-pg";

export async function resolveCalendarWorldId(subjectId: number): Promise<number> {
  return resolvePrivateWorldId(subjectId);
}
