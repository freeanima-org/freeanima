import { initCronModule } from "@freeanima/host/capabilities/connectors/cron";
import {
  invalidateSelfLayerPromptCache,
  loadSelfLayerPrompt,
} from "@freeanima/host/capabilities/self";
import { listAllOutpostInstances } from "@freeanima/host/core/db/pg/outpost";

import { createAppRuntime, type AppRuntime } from "../service/app-runtime.ts";
import { bindServicePorts } from "../bind-api.ts";
import { registerSystemPromptHooks } from "../register-prompt-hooks.ts";
import {
  registerNotificationInject,
  registerMemoryPassiveRecallHook,
  registerTemporalSummaryPeerInject,
  registerServiceMemoryBus,
  registerServiceStores,
} from "../register.ts";
import { createAcpSessionUpdatedHandler } from "../acp-conversation-callback.ts";
import { initRuntimeContext } from "../service/runtime-context.ts";
import { registerMemoryEngines } from "../service/memory-engines.ts";
import { initMaskSystem } from "../service/mask-bind.ts";
import { registerBootCronHandlers } from "./cron-handlers.ts";
import { registerSleepPipelineStepRecorder } from "../service/pipeline-step-run-log.ts";
import { startupLog } from "./status.ts";
import type { EnginePhaseResult } from "./engine-phase.ts";
import { bindRemoteToolsServerDeps } from "@freeanima/host/capabilities/outpost/transport/runtime-context.ts";
import { HabitatSessionRegistry } from "@freeanima/host/capabilities/outpost/transport/habitat-session-registry.ts";
import { RemoteInstanceRegistry } from "@freeanima/host/capabilities/outpost/transport/instance-registry.ts";
import { isConversationMeta } from "@freeanima/host/core/db/domain";
import { ANIMA_VERSION } from "../service/version.ts";
import { builtinFeaturePlugins, registerFeatures } from "../features/index.ts";
import { initHabitatRouter } from "../habitat/init.ts";

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
  const { kernel, engine, conversation, catalog, masks, mcp, outpost, acp } = phase;

  startupLog("Initializing AppRuntime / EventBus…");
  const runtime = createAppRuntime({
    kernel,
    engine,
    conversation,
    masks,
    mcp,
    outpost,
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

  bindServicePorts(runtime.fullDeps());
  initRuntimeContext(runtime);

  registerServiceStores(runtime.fullDeps(), engine.config);
  registerNotificationInject({ kernel });
  registerMemoryPassiveRecallHook({ kernel });
  registerTemporalSummaryPeerInject({ kernel });
  registerServiceMemoryBus({ kernel });
  invalidateSelfLayerPromptCache();
  await loadSelfLayerPrompt();

  initMaskSystem(masks);
  registerMemoryEngines(runtime.fullDeps());
  registerBootCronHandlers(engine);
  registerSleepPipelineStepRecorder();

  await initCronModule();
  startupLog("Cron scheduler started (Bun.cron)");

  registerSystemPromptHooks({
    hookRegistry: kernel.hookRegistry,
    getToolRegistry: () => catalog.toolSets,
  });

  initHabitatRouter();
  registerFeatures(builtinFeaturePlugins);

  outpost.loadSessionPlatformExtra = async (conversationId) => {
    const meta = await conversation.loadConversationMeta(conversationId);
    if (!isConversationMeta(meta)) return;
    return meta.platform_extra;
  };

  bindRemoteToolsServerDeps({
    runtime,
    remoteToolsManager: outpost,
    instanceRegistry: await createRemoteInstanceRegistry(),
    hubSessionRegistry: new HabitatSessionRegistry(),
    animaVersion: ANIMA_VERSION,
    masks,
  });

  return { runtime };
}

async function createRemoteInstanceRegistry(): Promise<RemoteInstanceRegistry> {
  const registry = new RemoteInstanceRegistry(true);
  try {
    const rows = await listAllOutpostInstances();
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
