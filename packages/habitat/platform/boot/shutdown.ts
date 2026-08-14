import { closeRedis, isRedisConfigured } from "@freeanima/habitat/core/redis";
import { stopCronModule } from "@freeanima/habitat/capabilities/connectors/cron";
import { stopPlatforms } from "@freeanima/habitat/capabilities/connectors/gateway";
import { logComponent } from "@freeanima/habitat/platform/logging";
import type { Kernel } from "@freeanima/habitat/kernel";
import type { MCPManager } from "@freeanima/habitat/capabilities/mcp-client";
import type { PlatformAdapter } from "@freeanima/habitat/capabilities/connectors/gateway";

import { closeDb } from "./persistence-phase.ts";
import { cleanStatusFile } from "./status.ts";
import type { AppRuntime } from "../service/app-runtime.ts";
import type { HttpHooks, HttpServerHandle } from "./types.ts";

export type ShutdownParams = {
  signal: string;
  runtime: AppRuntime;
  kernel: Kernel;
  mcp: MCPManager | null;
  platforms: PlatformAdapter[];
  cronInitialized: boolean;
  http?: HttpHooks;
  servers: HttpServerHandle[];
  waitForDrain: (app: AppRuntime, maxMs: number) => Promise<void>;
};

export async function gracefulShutdown(params: ShutdownParams): Promise<void> {
  const { signal, runtime, mcp, platforms, cronInitialized, servers } = params;
  void params.kernel;
  const http = params.http;
  const t0 = Date.now();
  const step = (label: string, ms: number) => {
    logComponent("shutdown").debug(label, { ms, elapsed_ms: Date.now() - t0 });
  };

  logComponent("shutdown").info(
    `Received ${signal}; starting graceful shutdown (prioritize pending message flush)`,
    { signal },
  );

  runtime.startShutdown();
  step("New requests rejected", Date.now() - t0);

  {
    const s = Date.now();
    await params.waitForDrain(runtime, 90_000);
    step("Request drain complete", Date.now() - s);
  }

  if (http && servers.length > 0) {
    const s = Date.now();
    logComponent("shutdown").debug("Closing HTTP/WebSocket listener…");
    await http.close(servers, 3000);
    step("HTTP/WebSocket listener closed", Date.now() - s);
  }

  {
    const s = Date.now();
    if (cronInitialized) stopCronModule();
    step("Cron scheduler stopped", Date.now() - s);
  }

  {
    const s = Date.now();
    if (platforms.length > 0) {
      logComponent("shutdown").debug(`Stopping ${platforms.length} Gateway platform(s)…`, {
        count: platforms.length,
      });
    } else {
      logComponent("shutdown").debug("No Gateway platforms");
    }
    await stopPlatforms(platforms);
    step("Gateway platforms stopped", Date.now() - s);
  }

  if (mcp) {
    const s = Date.now();
    await mcp.closeAll();
    step("MCP closed", Date.now() - s);
  }

  {
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
}
