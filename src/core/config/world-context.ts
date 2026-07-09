import type { RuntimeConfig } from "./schemas/runtime-config.ts";
import { ensureWorldSubjects, type EnsuredWorldSubjects } from "../db/pg/entity/subject-world.ts";

export type ResolvedWorldContext = EnsuredWorldSubjects;

export type SubjectKind = "user" | "agent";

export function resolveSubjectWorldId(kind: SubjectKind): number {
  const ctx = getResolvedWorldContext();
  return kind === "user" ? ctx.user_world_id : ctx.agent_world_id;
}

let resolvedWorldContext: ResolvedWorldContext | null = null;

export async function resolveAndBindWorldContext(
  config: RuntimeConfig,
): Promise<ResolvedWorldContext> {
  const ctx = await ensureWorldSubjects(config);
  resolvedWorldContext = ctx;
  return ctx;
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

export function resetResolvedWorldContextForTest(): void {
  resolvedWorldContext = null;
}
