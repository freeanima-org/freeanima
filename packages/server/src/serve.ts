import "@freeanima/legacy-runtime/system-prompt-wire";
import { chat, cleanupDebugSessions, initLlmRuntime, kernel, PROFILE_REFLECT } from "@freeanima/legacy-engine";
import {
  loadConfig,
  PATHS,
  installErrorLogHandlers,
  logComponent,
  logStartupError,
  markStartupPhase,
} from "@freeanima/legacy-kernel";
import { registerMemoryPipeline } from "@freeanima/legacy-memory";
import {
  NestService,
  Scheduler,
  enqueueRunJob,
  ensureBuiltinCronJobs,
  NEST_VERSION,
  seedHomeChannelsFromHermes,
  REPO_ROOT,
} from "@freeanima/legacy-runtime";
import { writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { chdir } from "node:process";

import { registerClarifyHooks } from "@freeanima/legacy-clarify";
import { registerReflectChat } from "@freeanima/legacy-memory";
import { registerAllTools } from "@freeanima/legacy-tools";
import {
  discoverPlatforms,
  startPlatforms,
  stopPlatforms,
  type PlatformAdapter,
} from "@freeanima/legacy-gateway";
import { MCPManager, getAcpManager } from "@freeanima/legacy-integrations";
import { closeDb, getDb, isPostgresPrimary } from "@freeanima/legacy-db";
import { DEFAULT_BIND_HOST, parseBindHosts } from "./bind-hosts";
import { closeHttpServers, waitForDrainWithTimeout } from "./http-shutdown";
import { initServiceContext } from "./service-context";
import { startWebuiHttpServers, type WebuiServerHandle } from "./webui-server";

export { isServerAlive, readStatusFile } from "./alive";
export { DEFAULT_BIND_HOST, DEFAULT_BIND_HOSTS, parseBindHosts, resolveProbeHost } from "./bind-hosts";

let service: NestService | null = null;
let mcp: MCPManager | null = null;
const acp = getAcpManager();
let cronScheduler: Scheduler | null = null;

export function getService(): NestService {
  if (!service) {
    service = new NestService();
    service.markStarted();
  }
  return service;
}

function scheduleDebugSessionCleanup(): void {
  void Promise.resolve()
    .then(async () => {
      startupLog("后台清理 debug 会话…");
      const cleaned = await cleanupDebugSessions(12);
      if (cleaned > 0) {
        logComponent("startup").info(`Cleaned ${cleaned} debug session(s)`, { count: cleaned });
      }
    })
    .catch((e) => logStartupError("debug 会话清理失败", e));
}

function startupLog(message: string): void {
  logComponent("startup").info(message);
}

function writeStatusFile(host: string, port: number, phase: "starting" | "ready" = "ready"): void {
  const status = {
    pid: process.pid,
    version: NEST_VERSION,
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

export type ServeOptions = {
  /** CLI 前台阻塞运行（systemd/detached 子进程亦会传 true，不等于 WebUI dev） */
  foreground?: boolean;
};

function useWebuiDevMode(foreground: boolean): boolean {
  if (process.env.ANIMA_WEBUI_DEV === "1") return true;
  if (process.env.ANIMA_WEBUI_DEV === "0") return false;
  return foreground;
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
  let servers: WebuiServerHandle[];
  try {
    startupLog("注册工具…");
    registerAllTools();
    registerClarifyHooks(kernel);
    acp.registerTools();

    mkdirSync(dirname(PATHS.pidFile), { recursive: true });
    writeFileSync(PATHS.pidFile, String(process.pid));

    if (isPostgresPrimary()) {
      startupLog("初始化 PostgreSQL 连接池…");
      getDb();
    }

    startupLog("初始化 LLM runtime…");
    initLlmRuntime(loadConfig());

    startupLog("初始化 NestService / EventBus…");
    service = new NestService();
    service.markStarted();
    const nest = service;

    registerReflectChat(async (messages) => {
      const resp = await chat(messages, { profileId: PROFILE_REFLECT });
      return { content: resp.content ?? null };
    });
    registerMemoryPipeline(kernel.eventBus);
    kernel.eventBus.start();
    service.setEventBus(kernel.eventBus);

    ensureBuiltinCronJobs();
    seedHomeChannelsFromHermes();
    cronScheduler = new Scheduler();
    cronScheduler.start((job) => enqueueRunJob(job));
    cronScheduler.rescheduleAll();
    startupLog("Cron 调度器已启动");

    mcp = new MCPManager();

    initServiceContext({ service: nest, mcp, acp, host: statusHost, port });

    const webuiDev = useWebuiDevMode(Boolean(opts.foreground));
    startupLog(webuiDev ? "启动 WebUI HTTP（Bun fullstack dev）…" : "启动 WebUI HTTP…");
    servers = await startWebuiHttpServers(bindHosts, port, { development: webuiDev });

    writeStatusFile(statusHost, port, "ready");
    for (const bindHost of bindHosts) {
      logComponent("startup").info(`逸灵风 listening on http://${bindHost}:${port}`, {
        host: bindHost,
        port,
      });
    }
    startupLog("HTTP 监听就绪");
    markStartupPhase(false);
    scheduleDebugSessionCleanup();
  } catch (err) {
    markStartupPhase(false);
    throw err;
  }

  let platforms: PlatformAdapter[] = [];
  const nest = service!;

  const shutdown = async (signal: string) => {
    const t0 = Date.now();
    const step = (label: string, ms: number) => {
      logComponent("shutdown").info(label, { ms, elapsed_ms: Date.now() - t0 });
    };

    logComponent("shutdown").info(`收到 ${signal}，开始优雅关停（优先等待未落盘消息）`, {
      signal,
    });

    nest.startShutdown();
    step("已拒绝新请求", Date.now() - t0);

    {
      const s = Date.now();
      await waitForDrainWithTimeout(nest, 90_000);
      step("请求排空完成", Date.now() - s);
    }

    {
      const s = Date.now();
      logComponent("shutdown").info("关闭 HTTP/WebSocket 监听…");
      await closeHttpServers(servers, 3000);
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
        logComponent("shutdown").info(`停止 ${platforms.length} 个 Gateway 平台…`, {
          count: platforms.length,
        });
      } else {
        logComponent("shutdown").info("无 Gateway 平台");
      }
      await stopPlatforms(platforms);
      step("Gateway 平台已停止", Date.now() - s);
    }

    {
      const s = Date.now();
      kernel.eventBus.stop();
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
  void discoverPlatforms(nest)
    .then(async (adapters) => {
      platforms = adapters;
      await startPlatforms(adapters);
    })
    .catch((err) => {
      logComponent("gateway").error("Platform startup failed", { err });
    });
}
