import { resolveSubjectWorldId } from "@freeanima/host/core/config";
import type { DiarySubjectKind } from "./types.ts";

export async function resolveDiaryWorldId(kind: DiarySubjectKind): Promise<number> {
  return resolveSubjectWorldId(kind);
}
