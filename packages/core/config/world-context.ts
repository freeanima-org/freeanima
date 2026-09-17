/**
 * World-context re-exports that are safe for client-side imports (no PG dependency).
 *
 * resolveAndBindWorldContext / resolvePrivateWorldId（需 PG）在 world-context-pg.ts，
 * 避免 config 桶把 `bun` 拖进浏览器构建。
 */
export type { ResolvedWorldContext, SubjectKind } from "./resolved-world-context.ts";
export {
  bindResolvedWorldContext,
  getResolvedWorldContext,
  tryGetResolvedWorldContext,
  resetResolvedWorldContextForTest,
  resolveSubjectWorldId,
  isSubjectEnabled,
} from "./resolved-world-context.ts";
