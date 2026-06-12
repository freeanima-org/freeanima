import type { FridgeBridge } from "@freeanima/capabilities-tasks";
import { registerTasksModule, syncTasksSummary } from "@freeanima/capabilities-tasks";
import { isRedisConfigured } from "@freeanima/connectors-redis";
import type { PgRepositories } from "@freeanima/storage-repos";
import { registerMemoryPipeline } from "@freeanima/capabilities-memory";
import { registerSelfLayerStore } from "@freeanima/capabilities-identity";

/** Composition root one-shot PG repository port injection (memory / self-layer / tasks) */
export function registerServiceStores(
  repos: PgRepositories,
  opts?: { fridgeBridge?: FridgeBridge },
): void {
  registerMemoryPipeline({
    sessionStore: repos.session,
    semanticStore: repos.semanticMemory,
    autobiographicalStore: repos.autobiographicalMemory,
    limbicStore: repos.limbicMemory,
  });
  registerSelfLayerStore(repos.selfLayer);
  registerTasksModule({
    taskStore: repos.tasks,
    fridgeBridge: opts?.fridgeBridge,
  });
}

/** Refresh tasks fridge summary on service startup (due titles + undated count) */
export async function bootstrapTasksFridgeSummary(
  repos: PgRepositories,
  fridgeBridge?: FridgeBridge,
): Promise<void> {
  if (!repos.pgAvailable || !fridgeBridge || !isRedisConfigured()) return;
  await syncTasksSummary(repos.tasks, fridgeBridge);
}
