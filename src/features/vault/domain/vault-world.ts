import type { SubjectKind } from "@freeanima/host/core/config";
import { getResolvedWorldContext } from "@freeanima/host/core/config/world-context";

export function resolveVaultWorldId(subject_kind: SubjectKind): number {
  const ctx = getResolvedWorldContext();
  return subject_kind === "user" ? ctx.user_world_id : ctx.agent_world_id;
}
