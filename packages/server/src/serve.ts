import "@freeanima/runtime/system-prompt-wire";
import { cleanupDebugSessions } from "@freeanima/engine";
import { EventBus, PATHS, hooks, installErrorLogHandlers, logStartupError, markStartupPhase } from "@freeanima/kernel";
import { registerMemoryPipeline } from "@freeanima/memory";
import { NestService, Scheduler, enqueueRunJob, ensureBuiltinCronJobs, NEST_VERSION, seedHomeChannelsFromHermes, WEBUI_DIST } from "@freeanima/runtime";
import { writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { serve as honoServe, type ServerType } from "@hono/node-server";

import { registerClarifyHooks } from "@freeanima/clarify";
import { registerReflectChat } from "@freeanima/memory";
import { chat } from "@freeanima/engine";
import { registerAllTools } from "@freeanima/tools";
import {
  discoverPlatforms,
  startPlatforms,
  stopPlatforms,
  type PlatformAdapter,
} from "@freeanima/gateway";
import { MCPManager, getAcpManager } from "@freeanima/integrations";
import { closeDb, getDb, isPostgresPrimary } from "@freeanima/db";
import { createApp } from "./http-app.js";
import { DEFAULT_BIND_HOST, parseBindHosts } from "./bind-hosts.js";
import { closeHttpServers, waitForDrainWithTimeout } from "./http-shutdown.js";

export { isServerAlive, readStatusFile } from "./alive.js";
export { DEFAULT_BIND_HOST, DEFAULT_BIND_HOSTS, parseBindHosts, resolveProbeHost } from "./bind-hosts.js";

let service: NestService | null = null;
let bus: EventBus | null = null;
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
      if (cleaned > 0) console.log(`Cleaned ${cleaned} debug session(s)`);
    })
    .catch((e) => logStartupError("debug 会话清理失败", e));
}

function startupLog(message: string): void {
  console.log(`[startup] ${message}`);
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

export async function serve(host = DEFAULT_BIND_HOST, port = 8080): Promise<void> {
  const bindHosts = parseBindHosts(host);
  const statusHost = bindHosts.join(",");
  installErrorLogHandlers();
  markStartupPhase(true);
  writeStatusFile(statusHost, port, "starting");
  let servers: ServerType[];
  try {
    startupLog("注册工具…");
    registerAllTools();
    registerClarifyHooks(hooks);
    acp.registerTools();

    mkdirSync(dirname(PATHS.pidFile), { recursive: true });
    writeFileSync(PATHS.pidFile, String(process.pid));

    if (isPostgresPrimary()) {
      startupLog("初始化 PostgreSQL 连接池…");
      getDb();
    }

    startupLog("初始化 NestService / EventBus…");
    service = new NestService();
    service.markStarted();
    const nest = service;

    bus = new EventBus();
    bus.resetStuck();
    registerReflectChat(async (messages) => {
      const resp = await chat(messages);
      return { content: resp.content ?? null };
    });
    registerMemoryPipeline(bus);
    bus.start();
    service.setEventBus(bus);

    ensureBuiltinCronJobs();
    seedHomeChannelsFromHermes();
    cronScheduler = new Scheduler();
    cronScheduler.start((job) => enqueueRunJob(job));
    cronScheduler.rescheduleAll();
    startupLog("Cron 调度器已启动");

    mcp = new MCPManager();

    startupLog("创建 HTTP 应用…");

    const { app, injectWebSocket } = createApp(nest, WEBUI_DIST, statusHost, port, mcp, acp);

    writeStatusFile(statusHost, port, "ready");
    for (const bindHost of bindHosts) {
      console.log(`逸灵风 listening on http://${bindHost}:${port}`);
    }

    servers = bindHosts.map((bindHost) => {
      const s = honoServe({ fetch: app.fetch, hostname: bindHost, port });
      injectWebSocket(s);
      return s;
    });
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
      console.log(`[shutdown] ${label} (+${ms}ms, 累计 ${Date.now() - t0}ms)`);
    };

    console.log(`[shutdown] 收到 ${signal}，开始优雅关停（优先等待未落盘消息）`);

    nest.startShutdown();
    step("已拒绝新请求", Date.now() - t0);

    {
      const s = Date.now();
      await waitForDrainWithTimeout(nest, 90_000);
      step("请求排空完成", Date.now() - s);
    }

    {
      const s = Date.now();
      console.log("[shutdown] 关闭 HTTP/WebSocket 监听…");
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
        console.log(`[shutdown] 停止 ${platforms.length} 个 Gateway 平台…`);
      } else {
        console.log("[shutdown] 无 Gateway 平台");
      }
      await stopPlatforms(platforms);
      step("Gateway 平台已停止", Date.now() - s);
    }

    {
      const s = Date.now();
      bus?.stop();
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
    console.log(`[shutdown] 关停完成，总耗时 ${Date.now() - t0}ms`);
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
      console.error(`Platform startup failed: ${err}`);
    });
}
