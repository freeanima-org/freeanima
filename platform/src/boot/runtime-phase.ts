import { initCronModule } from "@freeanima/platform/connectors/cron";
import {
  invalidateSelfLayerPromptCache,
  loadSelfLayerPrompt,
} from "@freeanima/capabilities-identity";
import { listAllSapInstances } from "@freeanima/core/db/pg/sap";

import { createAppRuntime, type AppRuntime } from "../runtime/app-runtime.ts";
import { wireServicePorts } from "../wire-api.ts";
import { registerSystemPromptHooks } from "../register-prompt-hooks.ts";
import {
  registerFridgeMagnet,
  registerNotificationInject,
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

  if (acpSessionUpdatedRef) acpSessionUpdatedRef.handler = acpHandler;

  wireServicePorts(runtime.fullDeps());
  initRuntimeContext(runtime);

  registerServiceStores(runtime.fullDeps(), engine.config);
  registerFridgeMagnet({ kernel });
  registerNotificationInject({ kernel });
  registerServiceMemoryBus({ kernel });
  invalidateSelfLayerPromptCache();
  await loadSelfLayerPrompt();

  initMaskSystem(masks);
  registerMemoryEngineWires(runtime.fullDeps());
  registerBootCronHandlers(engine);
  registerSleepPipelineStepRecorder();

  await initCronModule();
  startupLog("Cron scheduler started (Bun.cron)");

  registerSystemPromptHooks({
    hookRegistry: kernel.hookRegistry,
    getToolRegistry: () => catalog.toolSets,
  });

  satellite.loadSessionPlatformExtra = async (conversationId) => {
    const meta = await conversation.loadConversationMeta(conversationId);
    if (!isConversationMeta(meta)) return;
    return meta.platform_extra;
  };

  bindSapServerDeps({
    runtime,
    satelliteManager: satellite,
    instanceRegistry: await createSapInstanceRegistry(),
    animaVersion: ANIMA_VERSION,
    masks,
  });

  return { runtime };
}

async function createSapInstanceRegistry(): Promise<SapInstanceRegistry> {
  const registry = new SapInstanceRegistry(true);
  try {
    const rows = await listAllSapInstances();
    registry.hydrate(
      rows.map((row) => ({
        instanceId: row.instance_id,
        appId: row.app_id,
        httpUrl: row.http_url,
        createdAt: row.created_at.toISOString(),
      })),
    );
  } catch {
    /* PG unavailable at boot */
  }
  return registry;
}
