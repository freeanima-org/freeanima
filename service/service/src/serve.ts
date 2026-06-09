import "./wire-api.ts";
import "@freeanima/service/runtime/system-prompt-wire";
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
  getConfiguredDatabaseUrl,
  getConfiguredRedisUrl,
  loadConfig,
  PATHS,
  resolveLlmProviderApiKeys,
  validateConfigOnStartup,
} from "@freeanima/service-config";
import {
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
  registerServiceTools,
} from "./register.ts";
import { registerLightSleepWire } from "./runtime/light-sleep-wire.ts";
import { registerDeepSleepWire } from "./runtime/deep-sleep-wire.ts";
import { registerAutobiographyWire } from "./runtime/autobiography-wire.ts";
import { initMaskSystem } from "./runtime/mask-wire.ts";
import { MaskRegistry } from "@freeanima/capabilities-mask";
import { runLightSleep } from "@freeanima/life-memory/light-sleep/run";
import { runDeepSleep } from "@freeanima/life-memory/deep-sleep/run";
import { runSelfAutobiographyWithLog } from "@freeanima/life-memory/autobiography/run";
import {
  invalidateSelfLayerPromptCache,
  loadSelfLayerPrompt,
  registerSelfLayerStore,
} from "@freeanima/life-self";
import {
  registerAutobiographicalMemoryStore,
  registerLimbicMemoryStore,
  syncSemanticMemoryReferenceCounts,
} from "@freeanima/life-memory";
import {
  discoverPlatforms,
  startPlatforms,
  stopPlatforms,
  type PlatformAdapter,
} from "@freeanima/connectors-gateway";
import { MCPManager } from "@freeanima/capabilities-mcp";
import { getAcpManager } from "@freeanima/capabilities-acp";
import { registerTaskStore } from "@freeanima/capabilities-tasks/task-port";
import { DEFAULT_BIND_HOST, parseBindHosts } from "./bind-hosts.ts";
import { initServiceContext } from "./context.ts";
import { wireEmbeddingRuntime } from "./runtime/embedding-wire.ts";

let service: AnimaService | null = null;
let kernel: Kernel | null = null;
let engine: Engine | null = null;
let conversation: ConversationService | null = null;
let mcp: MCPManager | null = null;
const acp = getAcpManager();
let cronInitialized = false;

export function getService(): AnimaService {
  if (!service) {
    throw new Error("AnimaService 未初始化；请先调用 serve()");
  }
  return service;
}

function scheduleDebugSessionCleanup(conv: ConversationService): void {
  void Promise.resolve()
    .then(async () => {
      startupLog("后台清理 debug 会话…");
      const cleaned = await conv.cleanupDebugSessions(12);
      if (cleaned > 0) {
        logComponent("startup").debug(`Cleaned ${cleaned} debug session(s)`, { count: cleaned });
      }
    })
    .catch((e) => logStartupError("debug 会话清理失败", e));
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
  /** CLI 前台阻塞运行（systemd/detached 子进程亦会传 true，不等于 WebUI dev） */
  foreground?: boolean;
  webui?: WebuiHooks;
};

function useWebuiDevMode(foreground: boolean): boolean {
  if (process.env.ANIMA_WEBUI_DEV === "1") return true;
  if (process.env.ANIMA_WEBUI_DEV === "0") return false;
  return foreground;
}

async function defaultWaitForDrain(anima: AnimaService, maxMs: number): Promise<void> {
  await Promise.race([
    anima.waitForDrain(),
    new Promise<void>((resolve) => {
      setTimeout(() => {
        const n = anima.getInFlightCount();
        if (n > 0) {
          logComponent("shutdown").warn(`请求排空超时，仍有 ${n} 个进行中请求`, {
            max_ms: maxMs,
            in_flight: n,
          });
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
    logStartupError("无法切换到仓库根目录", err);
    throw err;
  }
  const bindHosts = parseBindHosts(host);
  const statusHost = bindHosts.join(",");
  installErrorLogHandlers();
  markStartupPhase(true);
  writeStatusFile(statusHost, port, "starting");
  let servers: WebuiServerHandle[] = [];
  try {
    startupLog("校验 config.yaml…");
    await validateConfigOnStartup();
    wireEmbeddingRuntime();

    startupLog("注册工具…");
    const catalog = createEngineCatalog();
    const masks = new MaskRegistry();
    registerServiceTools({ toolSets: catalog.toolSets, skills: catalog.skills });
    kernel = createServiceKernel();

    mkdirSync(dirname(PATHS.pidFile), { recursive: true });
    writeFileSync(PATHS.pidFile, String(process.pid));

    const dbUrl = await getConfiguredDatabaseUrl();
    initDatabase({ getDatabaseUrl: () => dbUrl });
    initRedis({ getRedisUrl: getConfiguredRedisUrl });

    const cfg = await resolveLlmProviderApiKeys(loadConfig());
    let repos = nullPgRepositories;
    if (isPostgresPrimary()) {
      startupLog("初始化 PostgreSQL 连接池…");
      const db = getDb();
      await runMigrations(db);
      startupLog("数据库迁移已完成");
      repos = createPgRepositories({ getDb });
    }
    initLlmRuntime(cfg);
    engine = createEngine({ repos, llm: getLlmRuntime(), catalog });
    conversation = createConversationService(engine.repos, catalog.toolSets);

    registerServiceIntegrations({
      kernel,
      conversation,
      toolSets: catalog.toolSets,
      skills: catalog.skills,
    });
    registerFridgeMagnet({ kernel });

    startupLog("初始化 AnimaService / EventBus…");
    service = new AnimaService({ kernel, conversation });
    service.markStarted();

    registerServiceMemoryBus({
      kernel,
      sessionStore: engine.repos.session,
      semanticStore: engine.repos.semanticMemory,
    });
    registerSelfLayerStore(repos.selfLayer);
    registerAutobiographicalMemoryStore(repos.autobiographicalMemory);
    registerLimbicMemoryStore(repos.limbicMemory);
    registerTaskStore(repos.tasks);
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
          selfContent,
        });
        return JSON.stringify(result);
      });

      registerCronBuiltinHandler("builtin-deep-sleep", async () => {
        const selfContent = await loadSelfLayerPrompt();
        const result = await runDeepSleep({ selfContent });
        return JSON.stringify(result);
      });

      registerCronBuiltinHandler("builtin-self-autobiography", async () => {
        const selfContent = await loadSelfLayerPrompt();
        const result = await runSelfAutobiographyWithLog({
          semanticStore: engine!.repos.semanticMemory,
          autoStore: engine!.repos.autobiographicalMemory,
          selfStore: engine!.repos.selfLayer,
          selfContent,
        });
        invalidateSelfLayerPromptCache();
        await loadSelfLayerPrompt();
        return JSON.stringify(result);
      });

      registerCronBuiltinHandler("builtin-memory-reference-sync", async () => {
        const result = await syncSemanticMemoryReferenceCounts(engine!.repos.memoryReference);
        return JSON.stringify(result);
      });

      await initCronModule({ store: repos.cron, logStore: repos.cronLog });
      cronInitialized = true;
      startupLog("Cron 调度器已启动 (Bun.cron)");
    } else {
      startupLog("PostgreSQL 不可用，跳过 Cron 模块");
    }

    mcp = new MCPManager(catalog.toolSets);

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

    const webuiDev = useWebuiDevMode(Boolean(opts.foreground));
    if (opts.webui) {
      startupLog(webuiDev ? "启动 WebUI HTTP（Bun fullstack dev）…" : "启动 WebUI HTTP…");
      servers = await opts.webui.start(bindHosts, port, { development: webuiDev });
    } else {
      startupLog("未注入 WebUI hooks，跳过 HTTP 监听");
    }

    writeStatusFile(statusHost, port, "ready");
    for (const bindHost of bindHosts) {
      logComponent("startup").info(`逸灵风 listening on http://${bindHost}:${port}`, {
        host: bindHost,
        port,
      });
    }
    startupLog("HTTP 监听就绪");
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

    logComponent("shutdown").info(`收到 ${signal}，开始优雅关停（优先等待未落盘消息）`, {
      signal,
    });

    service!.startShutdown();
    step("已拒绝新请求", Date.now() - t0);

    {
      const s = Date.now();
      await (opts.webui?.waitForDrain ?? defaultWaitForDrain)(service!, 90_000);
      step("请求排空完成", Date.now() - s);
    }

    if (opts.webui && servers.length > 0) {
      const s = Date.now();
      logComponent("shutdown").debug("关闭 HTTP/WebSocket 监听…");
      await opts.webui.close(servers, 3000);
      step("HTTP/WebSocket 监听已关闭", Date.now() - s);
    }

    {
      const s = Date.now();
      if (cronInitialized) stopCronModule();
      step("Cron 调度器已停止", Date.now() - s);
    }

    {
      const s = Date.now();
      if (platforms.length) {
        logComponent("shutdown").debug(`停止 ${platforms.length} 个 Gateway 平台…`, {
          count: platforms.length,
        });
      } else {
        logComponent("shutdown").debug("无 Gateway 平台");
      }
      await stopPlatforms(platforms);
      step("Gateway 平台已停止", Date.now() - s);
    }

    {
      const s = Date.now();
      kernel!.eventBus.stop();
      step("EventBus 已停止", Date.now() - s);
    }

    if (mcp) {
      const s = Date.now();
      await mcp.closeAll();
      step("MCP 已关闭", Date.now() - s);
    }

    {
      const s = Date.now();
      await acp.stopAll();
      step("ACP 已停止", Date.now() - s);
    }

    if (isPostgresPrimary()) {
      const s = Date.now();
      await closeDb();
      step("PostgreSQL 连接池已关闭", Date.now() - s);
    }

    if (isRedisConfigured()) {
      const s = Date.now();
      await closeRedis();
      step("Redis 连接已关闭", Date.now() - s);
    }

    cleanStatusFile();
    logComponent("shutdown").info("关停完成", { elapsed_ms: Date.now() - t0 });
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  mcp.startAllAsync();
  acp.startAllAsync();
  startAcpProgressTicker();
  void discoverPlatforms(service!)
    .then(async (adapters) => {
      platforms = adapters;
      await startPlatforms(adapters);
    })
    .catch((err) => {
      logComponent("gateway").error("Platform startup failed", { err });
    });
}
