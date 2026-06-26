import { registerEntityTaskModule } from "@freeanima/capabilities-task";
import type { FridgeBridge } from "@freeanima/capabilities-tasks";
import { registerTasksModule, syncTasksSummary } from "@freeanima/capabilities-tasks";
import { isRedisConfigured } from "@freeanima/platform/connectors/redis";
import type { PgRepositories } from "@freeanima/core/repos";
import { registerMemoryPipeline } from "@freeanima/capabilities-memory";
import { registerDreamFridge } from "@freeanima/capabilities-memory/dream-fridge-port";
import { registerSelfLayerStore } from "@freeanima/capabilities-identity";

import { createDreamFridgePort } from "./dream-fridge-factory.ts";

/** Composition root one-shot PG repository port injection (memory / self-layer / tasks) */
export function registerServiceStores(
  repos: PgRepositories,
  opts?: { fridgeBridge?: FridgeBridge },
): void {
  registerMemoryPipeline({
    conversationStore: repos.conversation,
    semanticStore: repos.semanticMemory,
    autobiographicalStore: repos.autobiographicalMemory,
    limbicStore: repos.limbicMemory,
    dreamStore: repos.dreamMemory,
  });
  registerDreamFridge(createDreamFridgePort());
  registerSelfLayerStore(repos.selfLayer);
  registerTasksModule({
    taskStore: repos.tasks,
    fridgeBridge: opts?.fridgeBridge,
  });
  registerEntityTaskModule({ entityStore: repos.entity });
}

/** Refresh tasks fridge summary on service startup (due titles + undated count) */
export async function bootstrapTasksFridgeSummary(
  repos: PgRepositories,
  fridgeBridge?: FridgeBridge,
): Promise<void> {
  if (!repos.pgAvailable || !fridgeBridge || !isRedisConfigured()) return;
  await syncTasksSummary(repos.tasks, fridgeBridge);
}
