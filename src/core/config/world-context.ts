import type { RuntimeConfig } from "./schemas/runtime-config.ts";
import { ensureWorldSubjects } from "../db/pg/entity/subject-world.ts";
import { bindResolvedWorldContext, type ResolvedWorldContext } from "./resolved-world-context.ts";

export type { ResolvedWorldContext, SubjectKind } from "./resolved-world-context.ts";
export {
  bindResolvedWorldContext,
  getResolvedWorldContext,
  resetResolvedWorldContextForTest,
  resolveSubjectWorldId,
} from "./resolved-world-context.ts";

export async function resolveAndBindWorldContext(
  config: RuntimeConfig,
): Promise<ResolvedWorldContext> {
  const ctx = await ensureWorldSubjects(config);
  bindResolvedWorldContext(ctx);
  return ctx;
}
