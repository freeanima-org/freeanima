import { initCronModule } from "@freeanima/habitat/capabilities/connectors/cron";
import {
  invalidateSelfLayerPromptCache,
  loadSelfLayerPrompt,
} from "@freeanima/habitat/capabilities/self";
import { listAllOutpostInstances } from "@freeanima/habitat/core/db/pg/outpost";

import { createAppRuntime, type AppRuntime } from "../service/app-runtime.ts";
import { bindServicePorts } from "../bind-api.ts";
import { registerSystemPromptHooks } from "../register-prompt-hooks.ts";
import {
  registerNotificationInject,
  registerMemoryPassiveRecallHook,
  registerTemporalSummaryPeerInject,
  registerServiceStores,
} from "../register.ts";
import { initRuntimeContext } from "../service/runtime-context.ts";
import { registerMemoryEngines } from "../service/memory-engines.ts";
import { registerBootCronHandlers } from "./cron-handlers.ts";
import { startupLog } from "./status.ts";
import type { EnginePhaseResult } from "./engine-phase.ts";
import { bindRemoteToolsServerDeps } from "@freeanima/habitat/capabilities/outpost/transport/runtime-context.ts";
import { HabitatSessionRegistry } from "@freeanima/habitat/capabilities/outpost/transport/habitat-session-registry.ts";
import { RemoteInstanceRegistry } from "@freeanima/habitat/capabilities/outpost/transport/instance-registry.ts";
import { isConversationMeta } from "@freeanima/habitat/core/db/domain";
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
  const { kernel, engine, conversation, catalog, mcp, outpost } = phase;

  startupLog("Initializing AppRuntime…");
  const runtime = createAppRuntime({
    kernel,
    engine,
    conversation,
    mcp,
    outpost,
    host,
    port,
  });
  runtimeRef.current = runtime;
  runtime.markStarted();

  runtime.setOnSessionUpdated((sid) => {
    if (acpSessionUpdatedRef) acpSessionUpdatedRef.handler?.(sid);
  });

  bindServicePorts(runtime.fullDeps());
  initRuntimeContext(runtime);

  registerServiceStores(runtime.fullDeps(), engine.config);
  registerNotificationInject({ kernel });
  registerMemoryPassiveRecallHook({ kernel });
  registerTemporalSummaryPeerInject({ kernel });
  invalidateSelfLayerPromptCache();
  {
    const { getResolvedWorldContext } =
      await import("@freeanima/habitat/core/config/world-context");
    await loadSelfLayerPrompt(getResolvedWorldContext().default_chat_agent_subject_id);
  }

  registerMemoryEngines(runtime.fullDeps());
  const { registerSemanticClusteringEmbeddingHook } =
    await import("@freeanima/habitat/capabilities/memory/clustering/register-hook.ts");
  registerSemanticClusteringEmbeddingHook();
  registerBootCronHandlers(engine);

  await initCronModule();
  startupLog("Cron scheduler started (Bun.cron)");

  const { seedBuiltinSkills } = await import("@freeanima/habitat/core/skill");
  await seedBuiltinSkills(catalog.skills);
  startupLog("Builtin skills seeded");

  const { seedBuiltinSubagents } = await import("@freeanima/features/subagent/domain");
  const subagentSeeded = await seedBuiltinSubagents();
  startupLog(`Builtin subagents seeded (${subagentSeeded} new)`);

  registerSystemPromptHooks({
    hookRegistry: kernel.hookRegistry,
    getToolRegistry: () => catalog.toolSets,
    getSkillRegistry: () => catalog.skills,
  });

  const { bindCodingProjectOverlays } =
    await import("@freeanima/features/coding/domain/bind-overlays.ts");
  bindCodingProjectOverlays();

  initHabitatRouter();
  registerFeatures(builtinFeaturePlugins);

  outpost.loadSessionPlatformExtra = async (conversationId) => {
    const meta = await conversation.loadConversationMeta(conversationId);
    if (!isConversationMeta(meta)) return undefined;
    return meta.platform_extra;
  };

  bindRemoteToolsServerDeps({
    runtime,
    remoteToolsManager: outpost,
    instanceRegistry: await createRemoteInstanceRegistry(),
    hubSessionRegistry: new HabitatSessionRegistry(),
    animaVersion: ANIMA_VERSION,
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
