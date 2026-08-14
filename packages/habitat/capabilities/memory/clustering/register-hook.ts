import { SEMANTIC_MEMORY_COMPONENT } from "@freeanima/habitat/core/db/schema";
import { getEntity } from "@freeanima/habitat/core/db/pg/entity";
import { logCapability as logComponent } from "@freeanima/habitat/core/config/capability-injection";
import {
  registerAfterEmbeddingStored,
  type AfterEmbeddingStoredFn,
} from "@freeanima/habitat/core/db/pg/embedding/runtime.ts";

import { assignIncrementalCluster } from "./calibrate.ts";

const log = logComponent("memory.clustering");

const afterStored: AfterEmbeddingStoredFn = async ({ kind, id, embedding }) => {
  if (kind !== "entity" && kind !== "semantic_memory") return;
  const entityId = Number(id);
  if (!Number.isInteger(entityId) || entityId <= 0) return;

  if (kind === "entity") {
    const row = await getEntity(entityId);
    if (!row || row.primary_component !== SEMANTIC_MEMORY_COMPONENT) return;
  }

  try {
    await assignIncrementalCluster(entityId, embedding);
  } catch (err) {
    log.warn("incremental cluster assign failed", { entityId, error: String(err) });
  }
};

/** 在 Habitat boot 注册：embedding 写入后对 semantic_memory 增量标簇 */
export function registerSemanticClusteringEmbeddingHook(): void {
  registerAfterEmbeddingStored(afterStored);
}
