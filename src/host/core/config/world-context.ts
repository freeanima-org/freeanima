/**
 * World-context re-exports that are safe for client-side imports (no PG dependency).
 *
 * resolveAndBindWorldContext (which requires PG) lives in world-context-pg.ts to
 * keep the config barrel export free of `bun` / database imports.
 */
export type { ResolvedWorldContext, SubjectKind } from "./resolved-world-context.ts";
export {
  bindResolvedWorldContext,
  getResolvedWorldContext,
  resetResolvedWorldContextForTest,
  resolveSubjectWorldId,
} from "./resolved-world-context.ts";
