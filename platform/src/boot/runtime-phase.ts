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
  bootstrapTasksFridgeSummary,
  registerServiceStores,
} from "../register.ts";
import { createFridgeBridge } from "../fridge-bridge-factory.ts";
import { createAcpSessionUpdatedHandler } from "../acp-session-callback.ts";
import { initRuntimeContext } from "../runtime/runtime-context.ts";
import { registerMemoryEngineWires } from "../runtime/memory-engines.ts";
import { initMaskSystem } from "../runtime/mask-wire.ts";
import { registerBootCronHandlers } from "./cron-handlers.ts";
import { registerSleepPipelineStepRecorder } from "../runtime/pipeline-step-run-log.ts";
import { startupLog } from "./status.ts";
import type { EnginePhaseResult } from "./engine-phase.ts";
import { bindSapServerDeps } from "../sap/runtime-context.ts";
import { SapInstanceRegistry } from "../sap/instance-registry.ts";
import { isSessionMeta } from "@freeanima/core/db/domain";
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

  const fridgeBridge = createFridgeBridge();
  registerServiceStores(repos, { fridgeBridge });
  registerFridgeMagnet({ kernel });
  await bootstrapTasksFridgeSummary(repos, fridgeBridge);
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

  satellite.loadSessionPlatformExtra = async (sessionId) => {
    const meta = await conversation.loadSessionMeta(sessionId);
    if (!isSessionMeta(meta)) return undefined;
    return meta.platform_extra;
  };

  bindSapServerDeps({
    runtime,
    satelliteManager: satellite,
    instanceRegistry: new SapInstanceRegistry(),
    animaVersion: ANIMA_VERSION,
    masks,
  });

  return { runtime };
}
