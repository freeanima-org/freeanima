import { wireEnginePorts } from "./wire-engine-ports.ts";
import { wireServicePorts } from "./wire-api.ts";
import {
  createEngine,
  createEngineCatalog,
  getLlmRuntime,
  initLlmRuntime,
  type Engine,
} from "@freeanima/engine";
import { createServiceKernel } from "@freeanima/service-bootstrap";
import { nullPgRepositories } from "@freeanima/engine-repos";
import {
  createConversationService,
  type ConversationService,
} from "@freeanima/engine-conversation";
import type { Kernel } from "@freeanima/kernel";
import {
  closeDb,
  createPgRepositories,
  getDb,
  initDatabase,
  isPostgresPrimary,
} from "@freeanima/connectors-db-pg";
import { closeRedis, initRedis, isRedisConfigured } from "@freeanima/connectors-redis";
import { runMigrations } from "@freeanima/engine-db";
import {
  FileConfig,
  getConfiguredDatabaseUrl,
  getConfiguredRedisUrl,
  PATHS,
  resolveLlmProviderApiKeys,
  validateConfigOnStartup,
} from "@freeanima/service-config";
import {
  createServiceLogger,
  installErrorLogHandlers,
  logComponent,
  logStartupError,
  markStartupPhase,
} from "@freeanima/service-logging";
import { AnimaService, ANIMA_VERSION, REPO_ROOT } from "./runtime/index.ts";
import {
  initCronModule,
  stopCronModule,
  registerCronBuiltinHandler,
} from "@freeanima/connectors-cron";
import { writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { chdir } from "node:process";

import {
  registerFridgeMagnet,
  registerServiceIntegrations,
  startAcpProgressTicker,
  registerServiceMemoryBus,
  registerServiceStores,
  registerServiceTools,
} from "./register.ts";
import { registerFridgeStore } from "@freeanima/capabilities-fridge-magnet";
import { createRedisFridgeStore } from "@freeanima/connectors-redis";
import { registerLightSleepWire } from "./runtime/light-sleep-wire.ts";
import { registerDeepSleepWire } from "./runtime/deep-sleep-wire.ts";
import { registerAutobiographyWire } from "./runtime/autobiography-wire.ts";
import { initMaskSystem } from "./runtime/mask-wire.ts";
import { MaskRegistry } from "@freeanima/capabilities-mask";
import { runLightSleep } from "@freeanima/life-memory/light-sleep/run";
import { runDeepSleep } from "@freeanima/life-memory/deep-sleep/run";
import { invalidateSelfLayerPromptCache, loadSelfLayerPrompt } from "@freeanima/life-self";
import { syncSemanticMemoryReferenceCounts } from "@freeanima/life-memory";
import {
  discoverPlatforms,
  startPlatforms,
  stopPlatforms,
  type PlatformAdapter,
} from "@freeanima/connectors-gateway";
import { MCPManager } from "@freeanima/capabilities-mcp";
import { getAcpManager } from "@freeanima/capabilities-acp";
import { createFridgeBridge } from "@freeanima/capabilities-tasks";
import { DEFAULT_BIND_HOST, parseBindHosts } from "./bind-hosts.ts";
import { bindHomeChannelConfig } from "@freeanima/service-api/home-channel";
import { initServiceContext } from "./context.ts";
import { wireEmbeddingRuntime } from "./runtime/embedding-wire.ts";
import { wireTokenizerRuntime } from "./runtime/tokenizer-wire.ts";
import { resolveWebuiDevMode } from "./webui-dev-mode.ts";

let service: AnimaService | null = null;
let kernel: Kernel | null = null;
let engine: Engine | null = null;
let conversation: ConversationService | null = null;
let mcp: MCPManager | null = null;
const acp = getAcpManager();
let cronInitialized = false;

export function getService(): AnimaService {
  if (!service) {
    throw new Error("AnimaService not initialized; call serve() first");
  }
  return service;
}

function scheduleDebugSessionCleanup(conv: ConversationService): void {
  void Promise.resolve()
    .then(async () => {
      startupLog("Cleaning up debug sessions in background…");
      const cleaned = await conv.cleanupDebugSessions(12);
      if (cleaned > 0) {
        logComponent("startup").debug(`Cleaned ${cleaned} debug session(s)`, { count: cleaned });
      }
    })
    .catch((e) => logStartupError("debug session cleanup failed", e));
}

function startupLog(message: string): void {
  logComponent("startup").debug(message);
}

function writeStatusFile(host: string, port: number, phase: "starting" | "ready" = "ready"): void {
  const status = {
    pid: process.pid,
    version: ANIMA_VERSION,
    start_time: Date.now() / 1000,
    host,
    port,
    phase,
  };
  mkdirSync(dirname(PATHS.statusFile), { recursive: true });
  writeFileSync(PATHS.statusFile, JSON.stringify(status, null, 2));
}

function cleanStatusFile(): void {
  try {
    unlinkSync(PATHS.statusFile);
  } catch {
    /* ignore */
  }
  try {
    unlinkSync(PATHS.pidFile);
  } catch {
    /* ignore */
  }
}

export type WebuiServerHandle = {
  close: () => void | Promise<void>;
};

export type WebuiHooks = {
  start: (
    hosts: string[],
    port: number,
    opts?: { development?: boolean },
  ) => Promise<WebuiServerHandle[]>;
  close: (handles: WebuiServerHandle[], timeoutMs?: number) => Promise<void>;
  waitForDrain: (anima: AnimaService, maxMs: number) => Promise<void>;
};

export type ServeOptions = {
  /** CLI foreground blocking run (systemd/detached child also passes true; not the same as WebUI dev) */
  foreground?: boolean;
  /** CLI --dev：WebUI Bun fullstack HMR */
  webuiDev?: boolean;
  webui?: WebuiHooks;
};

export { resolveWebuiDevMode } from "./webui-dev-mode.ts";

async function defaultWaitForDrain(anima: AnimaService, maxMs: number): Promise<void> {
  await Promise.race([
    anima.waitForDrain(),
    new Promise<void>((resolve) => {
      setTimeout(() => {
        const n = anima.getInFlightCount();
        if (n > 0) {
          logComponent("shutdown").warn(
            `Request drain timed out; ${n} in-flight request(s) remaining`,
            {
              max_ms: maxMs,
              in_flight: n,
            },
          );
        }
        resolve();
      }, maxMs);
    }),
  ]);
  if (anima.getInFlightCount() > 0) {
    anima.abortAll();
    await anima.waitForDrain();
  }
}

export async function serve(
  host = DEFAULT_BIND_HOST,
  port = 2658,
  opts: ServeOptions = {},
): Promise<void> {
  process.env.FREEANIMA_REPO_ROOT = REPO_ROOT;
  try {
    chdir(REPO_ROOT);
  } catch (err) {
    logStartupError("Failed to chdir to repo root", err);
    throw err;
  }
  const bindHosts = parseBindHosts(host);
  const statusHost = bindHosts.join(",");
  installErrorLogHandlers();
  markStartupPhase(true);
  writeStatusFile(statusHost, port, "starting");
  let servers: WebuiServerHandle[] = [];
  try {
    startupLog("Validating config.yaml…");
    await validateConfigOnStartup();
    const config = FileConfig.open();
    config.update(await resolveLlmProviderApiKeys(config.data));
    bindHomeChannelConfig(config);

    wireEnginePorts();
    wireServicePorts();
    wireEmbeddingRuntime(config);
    await wireTokenizerRuntime(config);

    startupLog("Registering tools…");
    const catalog = createEngineCatalog();
    const masks = new MaskRegistry();
    registerServiceTools({ toolSets: catalog.toolSets, skills: catalog.skills, config });
    kernel = createServiceKernel(config);

    mkdirSync(dirname(PATHS.pidFile), { recursive: true });
    writeFileSync(PATHS.pidFile, String(process.pid));

    const dbUrl = await getConfiguredDatabaseUrl(config.data);
    initDatabase({ getDatabaseUrl: () => dbUrl });
    initRedis({ getRedisUrl: () => getConfiguredRedisUrl(config.data) });

    let repos = nullPgRepositories;
    if (isPostgresPrimary()) {
      startupLog("Initializing PostgreSQL connection pool…");
      const db = getDb();
      await runMigrations(db);
      startupLog("Database migrations complete");
      repos = createPgRepositories({ getDb });
    }
    initLlmRuntime(config.data);
    const logger = createServiceLogger();
    engine = createEngine({ repos, llm: getLlmRuntime(), catalog, config, logger });
    conversation = createConversationService(engine.repos, catalog.toolSets);

    registerServiceIntegrations({
      kernel,
      conversation,
      toolSets: catalog.toolSets,
      skills: catalog.skills,
      config,
    });

    registerFridgeStore(createRedisFridgeStore());

    startupLog("Initializing AnimaService / EventBus…");
    service = new AnimaService({ kernel, conversation });
    service.markStarted();

    registerServiceStores(repos, { fridgeBridge: createFridgeBridge() });
    registerFridgeMagnet({ kernel });
    registerServiceMemoryBus({ kernel });
    if (repos.pgAvailable) {
      invalidateSelfLayerPromptCache();
      await loadSelfLayerPrompt();
    }
    service.setEventBus(kernel.eventBus);

    initMaskSystem(masks);
    registerLightSleepWire();
    registerDeepSleepWire();
    registerAutobiographyWire();

    if (repos.pgAvailable) {
      registerCronBuiltinHandler("builtin-light-sleep", async () => {
        const selfContent = await loadSelfLayerPrompt();
        const result = await runLightSleep({
          sessionStore: engine!.repos.session,
          semanticStore: engine!.repos.semanticMemory,
          autoStore: engine!.repos.autobiographicalMemory,
          selfStore: engine!.repos.selfLayer,
          selfContent,
        });
        invalidateSelfLayerPromptCache();
        await loadSelfLayerPrompt();
        return JSON.stringify(result);
      });

      registerCronBuiltinHandler("builtin-deep-sleep", async () => {
        const selfContent = await loadSelfLayerPrompt();
        const result = await runDeepSleep({ selfContent });
        return JSON.stringify(result);
      });

      registerCronBuiltinHandler("builtin-memory-reference-sync", async () => {
        const result = await syncSemanticMemoryReferenceCounts(engine!.repos.memoryReference);
        return JSON.stringify(result);
      });

      await initCronModule({ store: repos.cron, logStore: repos.cronLog });
      cronInitialized = true;
      startupLog("Cron scheduler started (Bun.cron)");
    } else {
      startupLog("PostgreSQL unavailable; skipping Cron module");
    }

    mcp = new MCPManager(catalog.toolSets, config);

    initServiceContext({
      service,
      kernel,
      engine,
      masks,
      conversation,
      mcp,
      acp,
      host: statusHost,
      port,
    });

    const webuiDev = resolveWebuiDevMode(opts.webuiDev);
    if (opts.webui) {
      startupLog(
        webuiDev
          ? "Starting WebUI HTTP (dev build + watch, static serving)…"
          : "Starting WebUI HTTP (production bundle, hash cache)…",
      );
      servers = await opts.webui.start(bindHosts, port, { development: webuiDev });
    } else {
      startupLog("WebUI hooks not injected; skipping HTTP listen");
    }

    writeStatusFile(statusHost, port, "ready");
    for (const bindHost of bindHosts) {
      logComponent("startup").info(`freeanima listening on http://${bindHost}:${port}`, {
        host: bindHost,
        port,
      });
    }
    startupLog("HTTP listen ready");
    markStartupPhase(false);
    scheduleDebugSessionCleanup(conversation);
  } catch (err) {
    markStartupPhase(false);
    throw err;
  }

  let platforms: PlatformAdapter[] = [];

  const shutdown = async (signal: string) => {
    const t0 = Date.now();
    const step = (label: string, ms: number) => {
      logComponent("shutdown").debug(label, { ms, elapsed_ms: Date.now() - t0 });
    };

    logComponent("shutdown").info(
      `Received ${signal}; starting graceful shutdown (prioritize pending message flush)`,
      {
        signal,
      },
    );

    service!.startShutdown();
    step("New requests rejected", Date.now() - t0);

    {
      const s = Date.now();
      await (opts.webui?.waitForDrain ?? defaultWaitForDrain)(service!, 90_000);
      step("Request drain complete", Date.now() - s);
    }

    if (opts.webui && servers.length > 0) {
      const s = Date.now();
      logComponent("shutdown").debug("Closing HTTP/WebSocket listener…");
      await opts.webui.close(servers, 3000);
      step("HTTP/WebSocket listener closed", Date.now() - s);
    }

    {
      const s = Date.now();
      if (cronInitialized) stopCronModule();
      step("Cron scheduler stopped", Date.now() - s);
    }

    {
      const s = Date.now();
      if (platforms.length) {
        logComponent("shutdown").debug(`Stopping ${platforms.length} Gateway platform(s)…`, {
          count: platforms.length,
        });
      } else {
        logComponent("shutdown").debug("No Gateway platforms");
      }
      await stopPlatforms(platforms);
      step("Gateway platforms stopped", Date.now() - s);
    }

    {
      const s = Date.now();
      kernel!.eventBus.stop();
      step("EventBus stopped", Date.now() - s);
    }

    if (mcp) {
      const s = Date.now();
      await mcp.closeAll();
      step("MCP closed", Date.now() - s);
    }

    {
      const s = Date.now();
      await acp.stopAll();
      step("ACP stopped", Date.now() - s);
    }

    if (isPostgresPrimary()) {
      const s = Date.now();
      await closeDb();
      step("PostgreSQL connection pool closed", Date.now() - s);
    }

    if (isRedisConfigured()) {
      const s = Date.now();
      await closeRedis();
      step("Redis connection closed", Date.now() - s);
    }

    cleanStatusFile();
    logComponent("shutdown").info("Shutdown complete", { elapsed_ms: Date.now() - t0 });
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  mcp.startAllAsync();
  acp.startAllAsync();
  startAcpProgressTicker();
  void discoverPlatforms(service!, engine!.config)
    .then(async (adapters) => {
      platforms = adapters;
      await startPlatforms(adapters);
    })
    .catch((err) => {
      logComponent("gateway").error("Platform startup failed", { err });
    });
}
