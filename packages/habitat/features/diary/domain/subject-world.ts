import { resolveSubjectWorldId } from "@freeanima/habitat/core/config";
import type { DiarySubjectKind } from "./types.ts";

export async function resolveDiaryWorldId(kind: DiarySubjectKind): Promise<number> {
  return resolveSubjectWorldId(kind);
}
