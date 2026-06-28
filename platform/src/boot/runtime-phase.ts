import { initCronModule } from "@freeanima/platform/connectors/cron";
import {
  invalidateSelfLayerPromptCache,
  loadSelfLayerPrompt,
} from "@freeanima/capabilities-identity";
import type { PgRepositories } from "@freeanima/core/repos";

import { createAppRuntime, type AppRuntime } from "../runtime/app-runtime.ts";
import { wireServicePorts } from "../wire-api.ts";
import { registerSystemPromptHooks } from "../register-prompt-hooks.ts";
import {
  registerFridgeMagnet,
  registerServiceMemoryBus,
  registerServiceStores,
} from "../register.ts";
import { createAcpSessionUpdatedHandler } from "../acp-conversation-callback.ts";
import { initRuntimeContext } from "../runtime/runtime-context.ts";
import { registerMemoryEngineWires } from "../runtime/memory-engines.ts";
import { initMaskSystem } from "../runtime/mask-wire.ts";
import { registerBootCronHandlers } from "./cron-handlers.ts";
import { registerSleepPipelineStepRecorder } from "../runtime/pipeline-step-run-log.ts";
import { startupLog } from "./status.ts";
import type { EnginePhaseResult } from "./engine-phase.ts";
import { bindSapServerDeps } from "../sap/runtime-context.ts";
import { SapInstanceRegistry } from "../sap/instance-registry.ts";
import { isConversationMeta } from "@freeanima/core/db/domain";
import { ANIMA_VERSION } from "../runtime/version.ts";

export type RuntimePhaseResult = {
  runtime: AppRuntime;
};

/** Phase 4: AppRuntime、ports、stores、memory engines、cron */
export async function bootRuntimePhase(
  phase: EnginePhaseResult,
  repos: PgRepositories,
  host: string,
  port: number,
  runtimeRef: { current: AppRuntime | null },
  acpSessionUpdatedRef?: { handler: ((sid: string) => void) | null },
): Promise<RuntimePhaseResult> {
  const { kernel, engine, conversation, catalog, masks, mcp, satellite, acp } = phase;

  startupLog("Initializing AppRuntime / EventBus…");
  const runtime = createAppRuntime({
    kernel,
    engine,
    conversation,
    masks,
    mcp,
    satellite,
    acp,
    host,
    port,
  });
  runtimeRef.current = runtime;
  runtime.markStarted();

  const acpHandler = createAcpSessionUpdatedHandler({
    conversation,
    getRuntime: () => runtimeRef.current,
  });
  runtime.setOnSessionUpdated(acpHandler);
  runtime.setEventBus(kernel.eventBus);

  // Bridge ACP result delivery → acp callback handler so completed/awaiting_decision
  // tasks trigger callback turns immediately, not just at next user-turn boundary.
  if (acpSessionUpdatedRef) acpSessionUpdatedRef.handler = acpHandler;

  wireServicePorts(runtime.fullDeps());
  initRuntimeContext(runtime);

  registerServiceStores(repos);
  registerFridgeMagnet({ kernel });
  registerServiceMemoryBus({ kernel });
  invalidateSelfLayerPromptCache();
  await loadSelfLayerPrompt();

  initMaskSystem(masks);
  registerMemoryEngineWires(runtime.fullDeps());
  registerBootCronHandlers(engine);
  registerSleepPipelineStepRecorder(repos);

  await initCronModule({ store: repos.cron, logStore: repos.cronLog });
  startupLog("Cron scheduler started (Bun.cron)");

  registerSystemPromptHooks({
    hookRegistry: kernel.hookRegistry,
    getToolRegistry: () => catalog.toolSets,
  });

  satellite.loadSessionPlatformExtra = async (conversationId) => {
    const meta = await conversation.loadConversationMeta(conversationId);
    if (!isConversationMeta(meta)) return undefined;
    return meta.platform_extra;
  };

  bindSapServerDeps({
    runtime,
    satelliteManager: satellite,
    instanceRegistry: await createSapInstanceRegistry(repos),
    animaVersion: ANIMA_VERSION,
    masks,
    remoteAuthToken: phase.remoteAuthToken,
  });

  return { runtime };
}

async function createSapInstanceRegistry(repos: PgRepositories): Promise<SapInstanceRegistry> {
  const registry = new SapInstanceRegistry(repos.sapInstance);
  if (repos.pgAvailable) {
    const rows = await repos.sapInstance.listAll();
    registry.hydrate(
      rows.map((row) => ({
        instanceId: row.instance_id,
        appId: row.app_id,
        httpUrl: row.http_url,
        createdAt: row.created_at.toISOString(),
      })),
    );
  }
  return registry;
}
