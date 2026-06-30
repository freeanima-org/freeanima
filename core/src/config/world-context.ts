import type { AnimaConfig } from "./schemas/config.ts";
import { ensureWorldSubjects, type EnsuredWorldSubjects } from "../db/pg/entity/subject-world.ts";

export type ResolvedWorldContext = EnsuredWorldSubjects;

let resolvedWorldContext: ResolvedWorldContext | null = null;

export async function resolveAndBindWorldContext(
  config: AnimaConfig,
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
