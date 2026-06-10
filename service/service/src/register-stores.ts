import type { FridgeBridge } from "@freeanima/capabilities-tasks";
import { registerTasksModule } from "@freeanima/capabilities-tasks";
import type { PgRepositories } from "@freeanima/engine-repos";
import { registerMemoryPipeline } from "@freeanima/life-memory";
import { registerSelfLayerStore } from "@freeanima/life-self";

/** 组合根一次性注入 PG 仓储端口（记忆 / 自我层 / 待办） */
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
