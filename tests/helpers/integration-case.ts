import type { PgTestContext } from "./pg-test.ts";
import { flushCompressionSummaries } from "@freeanima/engine-conversation";
import { createConversationService } from "@freeanima/engine-conversation";
import { createServiceKernel } from "@freeanima/service-bootstrap";
import { AnimaService, initServiceContext } from "@freeanima/service";
import { getAcpManager } from "@freeanima/capabilities-acp";
import {
  registerMemorySessionStore,
  registerSemanticMemoryStore,
  registerAutobiographicalMemoryStore,
  resetSemanticMemoryStoreForTests,
  resetMemorySessionStoreForTests,
  resetAutobiographicalMemoryStoreForTests,
} from "@freeanima/life-memory";
import {
  registerSelfLayerStore,
  resetSelfLayerStoreForTests,
  invalidateSelfLayerPromptCache,
  ensureSelfLayerSeeded,
  seedSelfLayerFromLegacy,
} from "@freeanima/life-self";

import { beginLogIsolation, resetServiceLogger } from "./log-isolation.ts";
import { clearConfigCache } from "@freeanima/service-config";
import { pgTestUrl } from "./pg-test-gate.ts";
import { getActivePgTestContext } from "./pg-test.ts";

async function flushActiveCompressionSummaries(): Promise<void> {
  const ctx = getActivePgTestContext();
  if (ctx) {
    await flushCompressionSummaries(ctx.engine.repos);
  }
}

/** 集成测标准 ServiceContext（builtins / AnimaService / WebUI handler） */
export function wireIntegrationServiceContext(pg: PgTestContext): void {
  const kernel = createServiceKernel();
  const conversation = createConversationService(pg.engine.repos);
  const service = new AnimaService({ kernel, conversation });
  getAcpManager().wireConversation(conversation);
  initServiceContext({
    service,
    kernel,
    engine: pg.engine,
    conversation,
    mcp: null,
    acp: getAcpManager(),
    host: "127.0.0.1",
    port: 2658,
  });
  resetSemanticMemoryStoreForTests();
  resetMemorySessionStoreForTests();
  resetAutobiographicalMemoryStoreForTests();
  resetSelfLayerStoreForTests();
  registerMemorySessionStore(pg.engine.repos.session);
  registerSemanticMemoryStore(pg.engine.repos.semanticMemory);
  registerAutobiographicalMemoryStore(pg.engine.repos.autobiographicalMemory);
  registerSelfLayerStore(pg.engine.repos.selfLayer);
  invalidateSelfLayerPromptCache();
}

/** 集成测：从 SOUL / pinned 写入 self_blocks 并刷新 prompt 缓存 */
export async function syncIntegrationSelfLayer(
  pg: PgTestContext,
  soulText?: string,
): Promise<void> {
  const resident = await pg.engine.repos.semanticMemory.listResident(100);
  const pinnedFacts = resident.map((row) => ({ content: row.content, type: row.type }));
  if (soulText !== undefined) {
    await seedSelfLayerFromLegacy({
      store: pg.engine.repos.selfLayer,
      soulText,
      pinnedFacts,
    });
  } else {
    await ensureSelfLayerSeeded({
      store: pg.engine.repos.selfLayer,
      pinnedFacts,
    });
  }
  invalidateSelfLayerPromptCache();
}

/** 集成测 afterEach：先等待异步压缩摘要，再恢复 FREEANIMA_HOME */
export async function restoreIntegrationHome(prevHome?: string): Promise<void> {
  await flushActiveCompressionSummaries();
  if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
  else process.env.FREEANIMA_HOME = prevHome;
  resetServiceLogger();
  clearConfigCache();
}

/** 集成测试用例标准开头：临时 home + PG harness + ServiceContext */
export async function beginIntegrationCase(prefix: string): Promise<{
  home: string;
  pg: PgTestContext;
}> {
  if (!pgTestUrl) {
    throw new Error("ANIMA_TEST_PG_URL 未设置；请用 bun test");
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
    throw new Error("ANIMA_TEST_PG_URL 未设置；请用 bun test");
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
