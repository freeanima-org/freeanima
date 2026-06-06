import "./wire-api.ts";
import "@freeanima/service/runtime/system-prompt-wire";
import { chat, getLlmRuntime, initLlmRuntime, PROFILE_REFLECT } from "@freeanima/engine";
import { createEngine, type Engine } from "@freeanima/engine";
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
  initPgProfile,
  isPostgresPrimary,
} from "@freeanima/connectors-db-pg";
import { runMigrations } from "@freeanima/engine-db";
import { getConfiguredDatabaseUrl, PATHS, loadConfig } from "@freeanima/service-config";
import {
  installErrorLogHandlers,
  logComponent,
  logStartupError,
  markStartupPhase,
} from "@freeanima/service-logging";
import {
  AnimaService,
  ANIMA_VERSION,
  seedHomeChannelsFromHermes,
  REPO_ROOT,
} from "./runtime/index.ts";
import {
  Scheduler,
  enqueueRunJob,
  ensureBuiltinCronJobs,
  type CronJob,
} from "@freeanima/connectors-cron";
import { writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { chdir } from "node:process";

import {
  registerServiceIntegrations,
  startAcpProgressTicker,
  registerServiceMemoryBus,
  registerServiceTools,
} from "./register.ts";
import type { ReflectChatFn } from "@freeanima/life-memory";
import {
  discoverPlatforms,
  startPlatforms,
  stopPlatforms,
  type PlatformAdapter,
} from "@freeanima/connectors-gateway";
import { MCPManager } from "@freeanima/capabilities-mcp";
import { getAcpManager } from "@freeanima/capabilities-acp";
import { DEFAULT_BIND_HOST, parseBindHosts } from "./bind-hosts.ts";
import { initServiceContext } from "./context.ts";

let service: AnimaService | null = null;
let kernel: Kernel | null = null;
let engine: Engine | null = null;
let conversation: ConversationService | null = null;
let mcp: MCPManager | null = null;
const acp = getAcpManager();
let cronScheduler: Scheduler | null = null;

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
    startupLog("注册工具…");
    registerServiceTools();
    kernel = createServiceKernel();

    mkdirSync(dirname(PATHS.pidFile), { recursive: true });
    writeFileSync(PATHS.pidFile, String(process.pid));

    initDatabase({ getDatabaseUrl: getConfiguredDatabaseUrl });
    initPgProfile({ sink: logComponent("db") });

    const cfg = loadConfig();
    let repos = nullPgRepositories;
    if (isPostgresPrimary()) {
      startupLog("初始化 PostgreSQL 连接池…");
      const db = getDb();
      await runMigrations(db);
      startupLog("数据库迁移已完成");
      repos = createPgRepositories({ getDb });
    }
    initLlmRuntime(cfg);
    engine = createEngine({ repos, llm: getLlmRuntime() });
    conversation = createConversationService(engine.repos);

    registerServiceIntegrations({ kernel, conversation });

    startupLog("初始化 AnimaService / EventBus…");
    service = new AnimaService({ kernel, conversation });
    service.markStarted();
    const nest = service;

    const reflectChat: ReflectChatFn = async (messages) => {
      const resp = await chat(messages, { profileId: PROFILE_REFLECT });
      return { content: resp.content ?? null };
    };
    registerServiceMemoryBus({
      kernel,
      sessionStore: engine.repos.session,
      semanticStore: engine.repos.semanticMemory,
      reflectChat,
    });
    service.setEventBus(kernel.eventBus);

    ensureBuiltinCronJobs();
    seedHomeChannelsFromHermes();
    cronScheduler = new Scheduler();
    cronScheduler.start((job: CronJob) => enqueueRunJob(job));
    cronScheduler.rescheduleAll();
    startupLog("Cron 调度器已启动");

    mcp = new MCPManager();

    initServiceContext({
      service: nest,
      kernel,
      engine,
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
  const nest = service!;

  const shutdown = async (signal: string) => {
    const t0 = Date.now();
    const step = (label: string, ms: number) => {
      logComponent("shutdown").debug(label, { ms, elapsed_ms: Date.now() - t0 });
    };

    logComponent("shutdown").info(`收到 ${signal}，开始优雅关停（优先等待未落盘消息）`, {
      signal,
    });

    nest.startShutdown();
    step("已拒绝新请求", Date.now() - t0);

    {
      const s = Date.now();
      await (opts.webui?.waitForDrain ?? defaultWaitForDrain)(nest, 90_000);
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
      cronScheduler?.stop();
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

    cleanStatusFile();
    logComponent("shutdown").info("关停完成", { elapsed_ms: Date.now() - t0 });
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  mcp.startAllAsync();
  acp.startAllAsync();
  startAcpProgressTicker();
  void discoverPlatforms(nest)
    .then(async (adapters) => {
      platforms = adapters;
      await startPlatforms(adapters);
    })
    .catch((err) => {
      logComponent("gateway").error("Platform startup failed", { err });
    });
}
