import type { PgTestContext } from "./pg-test.ts";
import { flushCompressionSummaries } from "@freeanima/engine-conversation";
import { createConversationService } from "@freeanima/engine-conversation";
import { createServiceKernel } from "@freeanima/service-bootstrap";
import { AnimaService, initServiceContext, wireServicePorts } from "@freeanima/service";
import { getAcpManager } from "@freeanima/capabilities-acp";
import { MaskRegistry } from "../../capabilities/mask/src/registry.ts";
import { registerServiceTools, resetRegisterServiceToolsForTest } from "@freeanima/service";
import {
  registerMemorySessionStore,
  registerSemanticMemoryStore,
  registerAutobiographicalMemoryStore,
  registerLimbicMemoryStore,
  resetSemanticMemoryStoreForTests,
  resetMemorySessionStoreForTests,
  resetAutobiographicalMemoryStoreForTests,
  resetLimbicMemoryStoreForTests,
} from "@freeanima/life-memory";
import {
  registerSelfLayerStore,
  resetSelfLayerStoreForTests,
  invalidateSelfLayerPromptCache,
} from "@freeanima/life-self";

import { bindHomeChannelConfig } from "@freeanima/service-api/home-channel";
import { beginLogIsolation, resetServiceLogger } from "./log-isolation.ts";
import { pgTestUrl } from "./pg-test-gate.ts";
import { getActivePgTestContext } from "./pg-test.ts";

async function flushActiveCompressionSummaries(): Promise<void> {
  const ctx = getActivePgTestContext();
  if (ctx) {
    await flushCompressionSummaries(ctx.engine.repos);
  }
}

/** Standard integration-test ServiceContext (builtins / AnimaService / WebUI handler) */
export function wireIntegrationServiceContext(pg: PgTestContext): void {
  bindHomeChannelConfig(pg.config);
  wireServicePorts();
  const kernel = createServiceKernel(pg.config);
  const conversation = createConversationService(pg.engine.repos, pg.engine.catalog.toolSets);
  const service = new AnimaService({ kernel, conversation });
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
  initServiceContext({
    service,
    kernel,
    engine: pg.engine,
    conversation,
    mcp: null,
    acp: getAcpManager(),
    masks: new MaskRegistry(),
    host: "127.0.0.1",
    port: 2658,
  });
  resetSemanticMemoryStoreForTests();
  resetMemorySessionStoreForTests();
  resetAutobiographicalMemoryStoreForTests();
  resetLimbicMemoryStoreForTests();
  resetSelfLayerStoreForTests();
  registerMemorySessionStore(pg.engine.repos.session);
  registerSemanticMemoryStore(pg.engine.repos.semanticMemory);
  registerAutobiographicalMemoryStore(pg.engine.repos.autobiographicalMemory);
  registerLimbicMemoryStore(pg.engine.repos.limbicMemory);
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

/** Standard integration test case setup: temp home + PG harness + ServiceContext */
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
  wireIntegrationServiceContext(pg);
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
  wireIntegrationServiceContext(pg);
  await syncIntegrationSelfLayer(pg);
  return { home, pg };
}

export async function endIntegrationCase(): Promise<void> {
  await flushActiveCompressionSummaries();
  const { teardownIntegrationHome } = await import("./pg-test.ts");
  await teardownIntegrationHome();
}
