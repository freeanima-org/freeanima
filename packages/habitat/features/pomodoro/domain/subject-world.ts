import { resolveSubjectWorldId } from "@freeanima/habitat/core/config";
import type { PomodoroSubjectKind } from "./types.ts";

export async function resolvePomodoroWorldId(kind: PomodoroSubjectKind): Promise<number> {
  return resolveSubjectWorldId(kind);
}
