import { getResolvedWorldContext } from "@freeanima/core/config";
import type { DiarySubjectKind } from "./types.ts";

export async function resolveDiaryWorldId(kind: DiarySubjectKind): Promise<number> {
  const ctx = getResolvedWorldContext();
  return kind === "user" ? ctx.user_world_id : ctx.agent_world_id;
}
