export type ResolvedWorldContext = {
  user_subject_id: number;
  agent_subject_id: number;
  user_world_id: number;
  agent_world_id: number;
  commons_world_id: number;
};

export type SubjectKind = "user" | "agent";

let resolvedWorldContext: ResolvedWorldContext | null = null;

export function resolveSubjectWorldId(kind: SubjectKind): number {
  const ctx = getResolvedWorldContext();
  return kind === "user" ? ctx.user_world_id : ctx.agent_world_id;
}

export function bindResolvedWorldContext(ctx: ResolvedWorldContext): void {
  resolvedWorldContext = ctx;
}

export function getResolvedWorldContext(): ResolvedWorldContext {
  if (!resolvedWorldContext) {
    throw new Error(
      "ResolvedWorldContext not bound; ensure resolveAndBindWorldContext() ran at boot",
    );
  }
  return resolvedWorldContext;
}

/** Bootstrap / early createEntity may run before world context is bound. */
export function tryGetResolvedWorldContext(): ResolvedWorldContext | null {
  return resolvedWorldContext;
}

export function resetResolvedWorldContextForTest(): void {
  resolvedWorldContext = null;
}
