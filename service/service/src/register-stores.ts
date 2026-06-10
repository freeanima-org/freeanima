import type { FridgeBridge } from "@freeanima/capabilities-tasks";
import { registerTasksModule } from "@freeanima/capabilities-tasks";
import type { PgRepositories } from "@freeanima/engine-repos";
import { registerMemoryPipeline } from "@freeanima/life-memory";
import { registerSelfLayerStore } from "@freeanima/life-self";

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
