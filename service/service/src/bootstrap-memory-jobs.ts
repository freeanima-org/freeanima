import { wireEnginePorts } from "./wire-engine-ports.ts";
import { wireCapabilityInjection } from "./wire-capability-injection.ts";
import { registerSystemPromptHooks } from "./register-prompt-hooks.ts";
import { wireServicePorts } from "./wire-api.ts";
import { chdir } from "node:process";
import { createEngine, createEngineCatalog } from "@freeanima/orchestration-runtime";
import { getLlmRuntime, initLlmRuntime } from "@freeanima/mechanism-llm";
import { createServiceKernel } from "@freeanima/service-bootstrap";
import { createConversationService } from "@freeanima/orchestration-conversation";
import {
  closeDb,
  createPgRepositories,
  getDb,
  initDatabase,
  isPostgresPrimary,
} from "@freeanima/connectors-db-pg";
import { closeRedis, initRedis } from "@freeanima/connectors-redis";
import { runMigrations } from "@freeanima/storage-db";
import type { PgRepositories } from "@freeanima/storage-repos";
import {
  FileConfig,
  getConfiguredDatabaseUrl,
  getConfiguredRedisUrl,
  resolveLlmProviderApiKeys,
  validateConfigOnStartup,
} from "@freeanima/service-config";
import { logStartupError, markStartupPhase } from "@freeanima/service-logging";
import { MCPManager } from "@freeanima/capabilities-mcp";
import { getAcpManager } from "@freeanima/capabilities-acp";
import { MaskRegistry } from "@freeanima/capabilities-mask";
import {
  invalidateSelfLayerPromptCache,
  loadSelfLayerPrompt,
} from "@freeanima/capabilities-identity";
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
    const config = FileConfig.open();
    config.update(await resolveLlmProviderApiKeys(config.data));

    wireEnginePorts();
    wireCapabilityInjection();
    wireServicePorts();
    wireEmbeddingRuntime(config);

    const catalog = createEngineCatalog();
    const masks = new MaskRegistry();
    registerServiceTools({ toolSets: catalog.toolSets, skills: catalog.skills, config });
    kernel = createServiceKernel(config);

    const dbUrl = await getConfiguredDatabaseUrl(config.data);
    initDatabase({ getDatabaseUrl: () => dbUrl });
    initRedis({ getRedisUrl: () => getConfiguredRedisUrl(config.data) });

    if (!isPostgresPrimary()) {
      throw new Error("PostgreSQL unavailable; memory jobs require PG");
    }

    const db = getDb();
    await runMigrations(db);
    const repos = createPgRepositories({ getDb });

    initLlmRuntime(config.data);
    const { createServiceLogger } = await import("@freeanima/service-logging");
    const engine = createEngine({
      repos,
      llm: getLlmRuntime(),
      catalog,
      config,
      logger: createServiceLogger(),
    });
    const conversation = createConversationService(engine.repos, catalog.toolSets);

    registerServiceIntegrations({
      kernel,
      conversation,
      toolSets: catalog.toolSets,
      skills: catalog.skills,
      config,
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

    mcp = new MCPManager(catalog.toolSets, config);

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

    registerSystemPromptHooks({
      hookRegistry: kernel.hookRegistry,
      getToolRegistry: () => catalog.toolSets,
    });

    markStartupPhase(false);

    return {
      repos,
      selfContent,
      async cleanup() {
        await closeDb();
        await closeRedis();
      },
    };
  } catch (err) {
    markStartupPhase(false);
    throw err;
  }
}
