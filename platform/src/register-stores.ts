import {
  registerEntityTaskModule,
  listTaskItems,
  syncAfterTaskMutation,
} from "@freeanima/capabilities-task";
import type { FridgeBridge } from "@freeanima/capabilities-task";
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
  registerEntityTaskModule({
    entityStore: repos.entity,
    fridgeBridge: opts?.fridgeBridge,
  });
}

/** Refresh tasks fridge summary on service startup (due titles + undated count) */
export async function bootstrapTasksFridgeSummary(
  repos: PgRepositories,
  fridgeBridge?: FridgeBridge,
): Promise<void> {
  if (!repos.pgAvailable || !fridgeBridge || !isRedisConfigured()) return;
  const items = await listTaskItems({ status: "pending", limit: 500 });
  await syncAfterTaskMutation(items);
}
