import type { ResolvedWorldContext } from "./world-context.ts";

export type SubjectKind = "user" | "agent";

export const SUBJECT_SCOPE_STORAGE_KEY = "freeanima.subjectScope";

export function resolveWorldIdForSubject(ctx: ResolvedWorldContext, kind: SubjectKind): number {
  if (kind === "user") return ctx.user_world_id;
  const id = ctx.default_chat_agent_world_id ?? ctx.agent_world_id;
  if (id == null) throw new Error("agent world id unavailable");
  return id;
}

export function resolveSubjectId(ctx: ResolvedWorldContext, kind: SubjectKind): number {
  if (kind === "user") return ctx.user_subject_id;
  const id = ctx.default_chat_agent_subject_id ?? ctx.agent_subject_id;
  if (id == null) throw new Error("agent subject id unavailable");
  return id;
}
