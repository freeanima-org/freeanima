import type { PgTestContext } from "./pg-test.ts";
import { flushCompressionSummaries } from "@freeanima/runtime/turn";
import { createConversationService } from "@freeanima/runtime/conversation";
import { createServiceKernel } from "@freeanima/platform/bootstrap";
import {
  createAppRuntime,
  initRuntimeContext,
  bindServicePorts,
  registerSystemPromptHooks,
} from "@freeanima/platform";
import { getAcpManager } from "@freeanima/capabilities/acp";
import { MaskRegistry } from "@freeanima/features/task/domain/mask";
import { initMaskSystem } from "@freeanima/platform/runtime/mask-bind";
import {
  registerServiceTools,
  registerServiceStores,
  resetRegisterServiceToolsForTest,
} from "@freeanima/platform";
import { invalidateSelfLayerPromptCache } from "@freeanima/capabilities/identity";
import { upsertSelfBlock } from "@freeanima/core/db/pg/self-layer";

import { randomUUID } from "node:crypto";
import { removeManagedAnimaTmpPath, removeTempDir } from "@freeanima/core/util/temp-dir";
import { conversations } from "@freeanima/core/db/schema";
import { isNotNull } from "drizzle-orm";

import { bindHomeChannelConfig } from "@freeanima/platform/ports/home-channel";
import { getDb } from "@freeanima/core/db/pg";
import { beginLogIsolation, resetServiceLogger } from "./log-isolation.ts";
import { pgTestUrl } from "./pg-test-gate.ts";
import { getActivePgTestContext } from "./pg-test.ts";
import { createIsolatedTestDb, dropIsolatedTestDb } from "../../scripts/integration-pg-setup.ts";

let activeIntegrationHome: string | undefined;
/** 本进程独立库 slug；afterAll endIntegrationCase 时 DROP */
let processDbSlug: string | undefined;
let processDbUrl: string | undefined;

async function cleanupIntegrationSessionCwds(): Promise<void> {
  const ctx = getActivePgTestContext();
  if (!ctx) return;
  const db = getDb();
  const rows = await db
    .select({ cwd: conversations.cwd })
    .from(conversations)
    .where(isNotNull(conversations.cwd));
  for (const row of rows) {
    if (row.cwd) removeManagedAnimaTmpPath(row.cwd);
  }
}

async function flushActiveCompressionSummaries(): Promise<void> {
  if (getActivePgTestContext()) {
    await flushCompressionSummaries();
  }
}

/** Standard integration-test AppRuntime (builtins / Habitat handler) */
export function bindIntegrationRuntimeContext(pg: PgTestContext): void {
  bindHomeChannelConfig(pg.config);
  const kernel = createServiceKernel(pg.config);
  const conversation = createConversationService(pg.engine.catalog.toolSets);
  const masks = new MaskRegistry();
  initMaskSystem(masks);
  const fullDeps = {
    kernel,
    engine: pg.engine,
    conversation,
    masks,
    mcp: null,
    outpost: null,
    acp: getAcpManager(),
    host: "127.0.0.1",
    port: 2658,
  };
  const runtime = createAppRuntime(fullDeps);
  bindServicePorts(fullDeps);
  initRuntimeContext(runtime);
  resetRegisterServiceToolsForTest();
  registerServiceTools({
    toolSets: pg.engine.catalog.toolSets,
    skills: pg.engine.catalog.skills,
    config: pg.config,
  });
  getAcpManager().bindRegistries({
    toolSets: pg.engine.catalog.toolSets,
    skills: pg.engine.catalog.skills,
    config: pg.config,
  });
  getAcpManager().bindConversation(conversation);
  registerSystemPromptHooks({
    hookRegistry: kernel.hookRegistry,
    getToolRegistry: () => pg.engine.catalog.toolSets,
  });
  registerServiceStores(fullDeps, pg.config);
  invalidateSelfLayerPromptCache();
}

export async function syncIntegrationSelfLayer(
  _pg: PgTestContext,
  selfModel?: string,
): Promise<void> {
  if (selfModel !== undefined) {
    await upsertSelfBlock({
      block_key: "self_model",
      content: selfModel,
      updated_by: "test",
    });
  }
  invalidateSelfLayerPromptCache();
}

/**
 * 本进程首次调用时从模板克隆独立库；同进程内复用（不清表）。
 * 配合 `bun test --parallel --isolate`：每文件一 worker → 每文件一库。
 * 顺序跑时：每个文件 afterAll endIntegrationCase DROP，下一文件再克隆。
 */
function ensureProcessIsolatedDb(): string {
  if (processDbUrl) return processDbUrl;
  if (!pgTestUrl) {
    throw new Error("ANIMA_TEST_PG_URL is not set; run just qa test-integration");
  }
  processDbSlug = `p_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  processDbUrl = createIsolatedTestDb(processDbSlug);
  return processDbUrl;
}

async function beginWithUrl(
  prefix: string,
  dbUrl: string,
  configYaml?: string,
): Promise<{ home: string; pg: PgTestContext }> {
  const home = beginLogIsolation(prefix);
  activeIntegrationHome = home;
  const { setupIntegrationHome } = await import("./pg-test.ts");
  const pg = await setupIntegrationHome({
    url: dbUrl,
    home,
    ...(configYaml !== undefined ? { configYaml } : {}),
  });
  bindIntegrationRuntimeContext(pg);
  await syncIntegrationSelfLayer(pg);
  return { home, pg };
}

/** Standard integration test case setup: temp home + 进程独立 PG + AppRuntime */
export async function beginIntegrationCase(prefix: string): Promise<{
  home: string;
  pg: PgTestContext;
}> {
  return beginWithUrl(prefix, ensureProcessIsolatedDb());
}

export async function beginIntegrationCaseWithConfig(
  prefix: string,
  configYaml: string,
): Promise<{ home: string; pg: PgTestContext }> {
  return beginWithUrl(prefix, ensureProcessIsolatedDb(), configYaml);
}

/** Integration afterEach: flush compression、清会话 cwd、删 temp home（不 DROP 库） */
export async function restoreIntegrationHome(prevHome?: string): Promise<void> {
  await flushActiveCompressionSummaries();
  await cleanupIntegrationSessionCwds();
  const tempHome = activeIntegrationHome;
  activeIntegrationHome = undefined;
  if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
  else process.env.FREEANIMA_HOME = prevHome;
  resetServiceLogger();
  removeTempDir(tempHome);
}

/** Integration afterAll: 关连接并 DROP 本进程独立库 */
export async function endIntegrationCase(): Promise<void> {
  await flushActiveCompressionSummaries();
  const { teardownIntegrationHome } = await import("./pg-test.ts");
  await teardownIntegrationHome();
  if (processDbSlug) {
    dropIsolatedTestDb(processDbSlug);
    processDbSlug = undefined;
    processDbUrl = undefined;
  }
}
