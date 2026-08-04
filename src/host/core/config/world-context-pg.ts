import type { RuntimeConfig } from "./schemas/runtime-config.ts";
import { ensureWorldSubjects } from "../db/pg/entity/subject-world.ts";
import { bindResolvedWorldContext, type ResolvedWorldContext } from "./resolved-world-context.ts";

/**
 * Resolve subject-world IDs from the database and bind them to the global context.
 * This is the PG-dependent entry point — kept separate from world-context.ts so the
 * barrel export (config/index.ts) doesn't drag PG deps (and `bun`) into client builds.
 */
export async function resolveAndBindWorldContext(
  config: RuntimeConfig,
): Promise<ResolvedWorldContext> {
  const ctx = await ensureWorldSubjects(config);
  bindResolvedWorldContext(ctx);
  return ctx;
}
