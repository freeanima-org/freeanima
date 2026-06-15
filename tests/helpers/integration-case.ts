import type { PgTestContext } from "./pg-test.ts";
import { flushCompressionSummaries } from "@freeanima/runtime/conversation";
import { createConversationService } from "@freeanima/runtime/conversation";
import { createServiceKernel } from "@freeanima/platform/bootstrap";
import {
  createAppRuntime,
  initRuntimeContext,
  wireServicePorts,
  registerSystemPromptHooks,
} from "@freeanima/platform";
import { getAcpManager } from "@freeanima/capabilities-acp";
import { MaskRegistry } from "@freeanima/capabilities-tasks/mask";
import { registerServiceTools, resetRegisterServiceToolsForTest } from "@freeanima/platform";
import {
  registerMemorySessionStore,
  registerSemanticMemoryStore,
  registerAutobiographicalMemoryStore,
  registerDreamMemoryStore,
  registerLimbicMemoryStore,
  resetSemanticMemoryStoreForTests,
  resetMemorySessionStoreForTests,
  resetAutobiographicalMemoryStoreForTests,
  resetDreamMemoryStoreForTests,
  resetLimbicMemoryStoreForTests,
  registerDreamFridge,
  resetDreamFridgeForTests,
} from "@freeanima/capabilities-memory";
import {
  registerSelfLayerStore,
  resetSelfLayerStoreForTests,
  invalidateSelfLayerPromptCache,
} from "@freeanima/capabilities-identity";

import { bindHomeChannelConfig } from "@freeanima/platform/ports/home-channel";
import { beginLogIsolation, resetServiceLogger } from "./log-isolation.ts";
import { pgTestUrl } from "./pg-test-gate.ts";
import { getActivePgTestContext } from "./pg-test.ts";

async function flushActiveCompressionSummaries(): Promise<void> {
  const ctx = getActivePgTestContext();
  if (ctx) {
    await flushCompressionSummaries(ctx.engine.repos);
  }
}

/** Standard integration-test AppRuntime (builtins / WebUI handler) */
export function wireIntegrationRuntimeContext(pg: PgTestContext): void {
  bindHomeChannelConfig(pg.config);
  const kernel = createServiceKernel(pg.config);
  const conversation = createConversationService(pg.engine.repos, pg.engine.catalog.toolSets);
  const masks = new MaskRegistry();
  const fullDeps = {
    kernel,
    engine: pg.engine,
    conversation,
    masks,
    mcp: null,
    acp: getAcpManager(),
    host: "127.0.0.1",
    port: 2658,
  };
  const runtime = createAppRuntime(fullDeps);
  wireServicePorts(fullDeps);
  initRuntimeContext(runtime);
  resetRegisterServiceToolsForTest();
  registerServiceTools({
    toolSets: pg.engine.catalog.toolSets,
    skills: pg.engine.catalog.skills,
    config: pg.config,
  });
  getAcpManager().wireRegistries({
    toolSets: pg.engine.catalog.toolSets,
    skills: pg.engine.catalog.skills,
    config: pg.config,
  });
  getAcpManager().wireConversation(conversation);
  registerSystemPromptHooks({
    hookRegistry: kernel.hookRegistry,
    getToolRegistry: () => pg.engine.catalog.toolSets,
  });
  resetSemanticMemoryStoreForTests();
  resetMemorySessionStoreForTests();
  resetAutobiographicalMemoryStoreForTests();
  resetDreamMemoryStoreForTests();
  resetLimbicMemoryStoreForTests();
  resetDreamFridgeForTests();
  resetSelfLayerStoreForTests();
  registerMemorySessionStore(pg.engine.repos.session);
  registerSemanticMemoryStore(pg.engine.repos.semanticMemory);
  registerAutobiographicalMemoryStore(pg.engine.repos.autobiographicalMemory);
  registerLimbicMemoryStore(pg.engine.repos.limbicMemory);
  registerDreamMemoryStore(pg.engine.repos.dreamMemory);
  registerDreamFridge({
    setReminder: async () => {},
    dismissReminder: async () => {},
  });
  registerSelfLayerStore(pg.engine.repos.selfLayer);
  invalidateSelfLayerPromptCache();
}

/** Integration test: optionally write self_model and refresh prompt cache */
export async function syncIntegrationSelfLayer(
  pg: PgTestContext,
  selfModel?: string,
): Promise<void> {
  if (selfModel !== undefined) {
    await pg.engine.repos.selfLayer.upsertBlock({
      block_key: "self_model",
      content: selfModel,
      updated_by: "test",
    });
  }
  invalidateSelfLayerPromptCache();
}

/** Integration test afterEach: wait for async compression summaries, then restore FREEANIMA_HOME */
export async function restoreIntegrationHome(prevHome?: string): Promise<void> {
  await flushActiveCompressionSummaries();
  if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
  else process.env.FREEANIMA_HOME = prevHome;
  resetServiceLogger();
}

/** Standard integration test case setup: temp home + PG harness + AppRuntime */
export async function beginIntegrationCase(prefix: string): Promise<{
  home: string;
  pg: PgTestContext;
}> {
  if (!pgTestUrl) {
    throw new Error("ANIMA_TEST_PG_URL is not set; run bun test");
  }
  const home = beginLogIsolation(prefix);
  const { setupIntegrationHome } = await import("./pg-test.ts");
  const pg = await setupIntegrationHome({ url: pgTestUrl, home });
  wireIntegrationRuntimeContext(pg);
  await syncIntegrationSelfLayer(pg);
  return { home, pg };
}

export async function beginIntegrationCaseWithConfig(
  prefix: string,
  configYaml: string,
): Promise<{ home: string; pg: PgTestContext }> {
  if (!pgTestUrl) {
    throw new Error("ANIMA_TEST_PG_URL is not set; run bun test");
  }
  const home = beginLogIsolation(prefix);
  const { setupIntegrationHome } = await import("./pg-test.ts");
  const pg = await setupIntegrationHome({ url: pgTestUrl, home, configYaml });
  wireIntegrationRuntimeContext(pg);
  await syncIntegrationSelfLayer(pg);
  return { home, pg };
}

export async function endIntegrationCase(): Promise<void> {
  await flushActiveCompressionSummaries();
  const { teardownIntegrationHome } = await import("./pg-test.ts");
  await teardownIntegrationHome();
}
