import { chdir } from "node:process";
import type { ConversationService } from "@freeanima/runtime/conversation";
import {
  installErrorLogHandlers,
  logComponent,
  logStartupError,
  markStartupPhase,
} from "@freeanima/platform/logging";
import { REPO_ROOT } from "./runtime/index.ts";
import { DEFAULT_BIND_HOST, parseBindHosts } from "./bind-hosts.ts";
import { resolveWebuiDevMode } from "./webui-dev-mode.ts";
import { getAppRuntime } from "./runtime/runtime-context.ts";
import { bootConfigPhase } from "./boot/config-phase.ts";
import { bootPersistencePhase } from "./boot/persistence-phase.ts";
import { bootEnginePhase } from "./boot/engine-phase.ts";
import { bootRuntimePhase } from "./boot/runtime-phase.ts";
import { startAsyncIntegrations } from "./boot/integrations-phase.ts";
import { gracefulShutdown } from "./boot/shutdown.ts";
import { startupLog, writeStatusFile } from "./boot/status.ts";
import type { ServeOptions, WebuiServerHandle } from "./boot/types.ts";
import type { AppRuntime } from "./runtime/app-runtime.ts";
import type { EnginePhaseResult } from "./boot/engine-phase.ts";

export type { ServeOptions, WebuiHooks, WebuiServerHandle } from "./boot/types.ts";
export { resolveWebuiDevMode } from "./webui-dev-mode.ts";

async function defaultWaitForDrain(app: AppRuntime, maxMs: number): Promise<void> {
  await Promise.race([
    app.waitForDrain(),
    new Promise<void>((resolve) => {
      setTimeout(() => {
        const n = app.getInFlightCount();
        if (n > 0) {
          logComponent("shutdown").warn(
            `Request drain timed out; ${n} in-flight request(s) remaining`,
            { max_ms: maxMs, in_flight: n },
          );
        }
        resolve();
      }, maxMs);
    }),
  ]);
  if (app.getInFlightCount() > 0) {
    app.abortAll();
    await app.waitForDrain();
  }
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
  let enginePhase: EnginePhaseResult | null = null;
  let cronInitialized = false;
  const platformsRef: {
    list: import("@freeanima/platform/connectors/gateway").PlatformAdapter[];
  } = { list: [] };

  try {
    const { config } = await bootConfigPhase();
    const { repos } = await bootPersistencePhase(config);

    const acpSessionUpdatedRef: { handler: ((sid: string) => void) | null } = { handler: null };
    const runtimeRef: { current: AppRuntime | null } = { current: null };

    enginePhase = bootEnginePhase(config, repos, (sid) => {
      acpSessionUpdatedRef.handler?.(sid);
      runtimeRef.current?.pokeSessionWatchers(sid);
    });

    const { runtime } = await bootRuntimePhase(enginePhase, repos, statusHost, port, runtimeRef);
    cronInitialized = true;

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
    scheduleDebugSessionCleanup(enginePhase.conversation);

    startAsyncIntegrations({
      mcp: enginePhase.mcp,
      acp: enginePhase.acp,
      runtime,
      engine: enginePhase.engine,
      platformsRef,
    });
  } catch (err) {
    markStartupPhase(false);
    throw err;
  }

  if (!enginePhase) {
    throw new Error("Engine phase failed to initialize");
  }

  const { kernel, mcp, acp } = enginePhase;
  const runtime = getAppRuntime();

  const shutdown = async (signal: string) => {
    await gracefulShutdown({
      signal,
      runtime,
      kernel,
      mcp,
      acp,
      platforms: platformsRef.list,
      cronInitialized,
      webui: opts.webui,
      servers,
      waitForDrain: opts.webui?.waitForDrain ?? defaultWaitForDrain,
    });
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}
