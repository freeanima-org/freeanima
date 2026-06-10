import "./wire-api.ts";
import { chdir } from "node:process";
import {
  createEngine,
  createEngineCatalog,
  getLlmRuntime,
  initLlmRuntime,
} from "@freeanima/engine";
import { createServiceKernel } from "@freeanima/service-bootstrap";
import { createConversationService } from "@freeanima/engine-conversation";
import {
  closeDb,
  createPgRepositories,
  getDb,
  initDatabase,
  isPostgresPrimary,
} from "@freeanima/connectors-db-pg";
import { closeRedis, initRedis, isRedisConfigured } from "@freeanima/connectors-redis";
import { runMigrations } from "@freeanima/engine-db";
import type { PgRepositories } from "@freeanima/engine-repos";
import {
  getConfiguredDatabaseUrl,
  getConfiguredRedisUrl,
  loadConfig,
  resolveLlmProviderApiKeys,
  validateConfigOnStartup,
} from "@freeanima/service-config";
import { logStartupError, markStartupPhase } from "@freeanima/service-logging";
import { MCPManager } from "@freeanima/capabilities-mcp";
import { getAcpManager } from "@freeanima/capabilities-acp";
import { MaskRegistry } from "@freeanima/capabilities-mask";
import { invalidateSelfLayerPromptCache, loadSelfLayerPrompt } from "@freeanima/life-self";
import { registerServiceIntegrations, registerServiceTools } from "./register.ts";
import { registerServiceStores } from "./register-stores.ts";
import { AnimaService, REPO_ROOT } from "./runtime/index.ts";
import { registerLightSleepWire } from "./runtime/light-sleep-wire.ts";
import { registerAutobiographyWire } from "./runtime/autobiography-wire.ts";
import { initMaskSystem } from "./runtime/mask-wire.ts";
import { initServiceContext } from "./context.ts";
import { wireEmbeddingRuntime } from "./runtime/embedding-wire.ts";

export type MemoryJobsContext = {
  repos: PgRepositories;
  selfContent: string;
  cleanup: () => Promise<void>;
};

/** Minimal memory batch bootstrap: PG + engine + wire; no HTTP/Cron/Gateway */
export async function bootstrapMemoryJobs(): Promise<MemoryJobsContext> {
  process.env.FREEANIMA_REPO_ROOT = REPO_ROOT;
  try {
    chdir(REPO_ROOT);
  } catch (err) {
    logStartupError("Failed to chdir to repo root", err);
    throw err;
  }

  markStartupPhase(true);
  let kernel: ReturnType<typeof createServiceKernel> | null = null;
  let mcp: MCPManager | null = null;
  const acp = getAcpManager();

  try {
    await validateConfigOnStartup();
    wireEmbeddingRuntime();

    const catalog = createEngineCatalog();
    const masks = new MaskRegistry();
    registerServiceTools({ toolSets: catalog.toolSets, skills: catalog.skills });
    kernel = createServiceKernel();

    const dbUrl = await getConfiguredDatabaseUrl();
    initDatabase({ getDatabaseUrl: () => dbUrl });
    initRedis({ getRedisUrl: getConfiguredRedisUrl });

    if (!isPostgresPrimary()) {
      throw new Error("PostgreSQL unavailable; memory jobs require PG");
    }

    const db = getDb();
    await runMigrations(db);
    const repos = createPgRepositories({ getDb });

    const cfg = await resolveLlmProviderApiKeys(loadConfig());
    initLlmRuntime(cfg);
    const engine = createEngine({ repos, llm: getLlmRuntime(), catalog });
    const conversation = createConversationService(engine.repos, catalog.toolSets);

    registerServiceIntegrations({
      kernel,
      conversation,
      toolSets: catalog.toolSets,
      skills: catalog.skills,
    });

    const service = new AnimaService({ kernel, conversation });
    service.markStarted();

    registerServiceStores(repos);

    invalidateSelfLayerPromptCache();
    const selfContent = await loadSelfLayerPrompt();
    service.setEventBus(kernel.eventBus);

    initMaskSystem(masks);
    registerLightSleepWire();
    registerAutobiographyWire();

    mcp = new MCPManager(catalog.toolSets);

    initServiceContext({
      service,
      kernel,
      engine,
      masks,
      conversation,
      mcp,
      acp,
      host: "127.0.0.1",
      port: 0,
    });

    return {
      repos,
      selfContent,
      cleanup: async () => {
        kernel!.eventBus.stop();
        if (mcp) await mcp.closeAll();
        await acp.stopAll();
        if (isPostgresPrimary()) await closeDb();
        if (isRedisConfigured()) await closeRedis();
        markStartupPhase(false);
      },
    };
  } catch (err) {
    markStartupPhase(false);
    throw err;
  }
}
