import type { ResolvedWorldContext } from "./world-context.ts";

export type SubjectKind = "user" | "agent";

export const SUBJECT_SCOPE_STORAGE_KEY = "freeanima.subjectScope";

export function resolveWorldIdForSubject(ctx: ResolvedWorldContext, kind: SubjectKind): number {
  return kind === "user" ? ctx.user_world_id : ctx.agent_world_id;
}

export function resolveSubjectId(ctx: ResolvedWorldContext, kind: SubjectKind): number {
  return kind === "user" ? ctx.user_subject_id : ctx.agent_subject_id;
}
