import { registerMemoryPipeline } from "@freeanima/capabilities-memory";
import { registerDreamFridge } from "@freeanima/capabilities-memory/dream-fridge-port";
import { registerSelfLayerStore } from "@freeanima/capabilities-identity";
import { registerEntityTaskModule } from "@freeanima/capabilities-task";
import { registerEntitySearchModule } from "@freeanima/capabilities-tools";
import type { PgRepositories } from "@freeanima/core/repos";
import { resolvePublicAccessibleWorldIds } from "@freeanima/platform/connectors/db-pg";

import { createDreamFridgePort } from "./dream-fridge-factory.ts";

/** Composition root one-shot PG repository port injection (memory / self-layer / tasks) */
export function registerServiceStores(repos: PgRepositories): void {
  registerMemoryPipeline({
    conversationStore: repos.conversation,
    semanticStore: repos.semanticMemory,
    autobiographicalStore: repos.autobiographicalMemory,
    limbicStore: repos.limbicMemory,
    dreamStore: repos.dreamMemory,
  });
  registerDreamFridge(createDreamFridgePort());
  registerSelfLayerStore(repos.selfLayer);
  registerEntitySearchModule({
    search: repos.entitySearch,
    resolveAccessibleWorldIds: () => resolvePublicAccessibleWorldIds(repos.entity),
  });
  registerEntityTaskModule({ entityStore: repos.entity, entitySearch: repos.entitySearch });
}
