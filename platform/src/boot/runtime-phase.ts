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
import { startupLog } from "./status.ts";
import type { EnginePhaseResult } from "./engine-phase.ts";

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
  const { kernel, engine, conversation, catalog, masks, mcp, acp } = phase;

  startupLog("Initializing AppRuntime / EventBus…");
  const runtime = createAppRuntime({
    kernel,
    engine,
    conversation,
    masks,
    mcp,
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

  await initCronModule({ store: repos.cron, logStore: repos.cronLog });
  startupLog("Cron scheduler started (Bun.cron)");

  registerSystemPromptHooks({
    hookRegistry: kernel.hookRegistry,
    getToolRegistry: () => catalog.toolSets,
  });

  return { runtime };
}
