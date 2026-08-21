import type { RuntimeConfig } from "./schemas/runtime-config.ts";
import { getEntity } from "@freeanima/habitat/core/db/pg/entity/repos/entity-crud-repo.ts";
import { subjectConfigBodySchema } from "@freeanima/habitat/core/db/schema/entity";
import { ensureWorldSubjects } from "../db/pg/entity/subject-world.ts";
import {
  bindResolvedWorldContext,
  isSubjectEnabled,
  type ResolvedWorldContext,
} from "./resolved-world-context.ts";

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

/** subject 实体 id → 其 default_private_world_id（需 PG；勿放进浏览器安全桶） */
export async function resolvePrivateWorldId(subjectId: number): Promise<number> {
  if (!Number.isInteger(subjectId) || subjectId <= 0) {
    throw new Error(`invalid subject_id: ${subjectId}`);
  }
  const row = await getEntity(subjectId);
  if (!row || (row.type !== "user" && row.type !== "agent")) {
    throw new Error(`subject ${subjectId} not found`);
  }
  if (row.type === "agent" && !isSubjectEnabled(row.body)) {
    throw new Error(`agent subject ${subjectId} is disabled`);
  }
  const parsed = subjectConfigBodySchema.safeParse(row.body ?? {});
  const worldId = parsed.success ? parsed.data.default_private_world_id : undefined;
  if (worldId == null || worldId <= 0) {
    throw new Error(`subject ${subjectId} has no default_private_world_id`);
  }
  return worldId;
}
