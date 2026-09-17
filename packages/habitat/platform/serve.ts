import { chdir } from "node:process";
import { omitUndefined } from "@freeanima/habitat/core/util";
import type { ConversationService } from "@freeanima/habitat/engine/conversation";
import {
  installErrorLogHandlers,
  logComponent,
  logStartupError,
  markStartupPhase,
} from "@freeanima/habitat/platform/logging";
import { REPO_ROOT } from "./service/index.ts";
import { DEFAULT_BIND_HOST, coalesceBindHosts, parseBindHosts } from "./bind-hosts.ts";
import { getAppRuntime } from "./service/runtime-context.ts";
import { ensureRootContext } from "@freeanima/kernel";
import { runBootPipelineViaLoader } from "./boot/loader.ts";
import { startAsyncIntegrations } from "./boot/phases.ts";
import { gracefulShutdown } from "./boot/shutdown.ts";
import { startupLog, writeStatusFile } from "./boot/status.ts";
import type { HttpServerHandle, ServeOptions } from "./boot/types.ts";
import type { AppRuntime } from "./service/app-runtime.ts";
import type { EnginePhaseResult } from "./boot/engine-phase.ts";

export type { ServeOptions, HttpHooks, HttpServerHandle } from "./boot/types.ts";

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
      startupLog("Cleaning up debug conversations in background…");
      const cleaned = await conv.cleanupDebugConversations(12);
      if (cleaned > 0) {
        logComponent("startup").debug(`Cleaned ${cleaned} debug conversation(s)`, {
          count: cleaned,
        });
      }
    })
    .catch((e) => logStartupError("debug conversation cleanup failed", e));
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

  const bindHosts = coalesceBindHosts(parseBindHosts(host));
  const statusHost = bindHosts.join(",");
  installErrorLogHandlers();
  markStartupPhase(true);
  writeStatusFile(statusHost, port, "starting");

  let servers: HttpServerHandle[] = [];
  let enginePhase: EnginePhaseResult | null = null;
  let cronInitialized = false;
  const httpHooks = opts.http;
  const platformsRef: {
    list: import("@freeanima/habitat/capabilities/connectors/gateway").PlatformAdapter[];
  } = { list: [] };

  try {
    const root = ensureRootContext();
    const acpSessionUpdatedRef: { handler: ((sid: string) => void) | null } = { handler: null };
    const runtimeRef: { current: AppRuntime | null } = { current: null };

    await runBootPipelineViaLoader(root, {
      statusHost,
      port,
      onConversationUpdated: (sid) => {
        acpSessionUpdatedRef.handler?.(sid);
        runtimeRef.current?.pokeSessionWatchers(sid);
      },
      runtimeRef,
      acpSessionUpdatedRef,
      serveOpts: opts,
    });

    enginePhase = root.bootEngine;
    const { runtime } = root.bootRuntime;
    cronInitialized = true;

    const http = httpHooks;
    let tlsPort: number | null = null;
    if (http) {
      startupLog("Starting Habitat HTTP (API + Habitat RPC)…");
      const started = await http.start(bindHosts, port, opts.httpListen);
      servers = started.handles;
      tlsPort = started.tlsPort;
    } else {
      startupLog("HTTP hooks not injected; skipping HTTP listen");
    }

    writeStatusFile(statusHost, port, "ready", tlsPort);
    for (const bindHost of bindHosts) {
      logComponent("startup").info(`freeanima listening on http://${bindHost}:${port}`, {
        host: bindHost,
        port,
      });
      if (tlsPort != null) {
        logComponent("startup").info(`freeanima listening on https://${bindHost}:${tlsPort}`, {
          host: bindHost,
          port: tlsPort,
        });
      }
    }
    startupLog("HTTP listen ready");
    markStartupPhase(false);
    await opts.onReady?.();
    scheduleDebugSessionCleanup(enginePhase.conversation);

    const { bindRuntimeConfigApplyDeps } = await import("./config/runtime-config-apply.ts");
    bindRuntimeConfigApplyDeps({
      getMcp: () => enginePhase?.mcp ?? null,
      getEngine: () => enginePhase?.engine ?? null,
      getMessaging: () => runtime,
      getPlatformsRef: () => platformsRef,
    });

    startAsyncIntegrations({
      mcp: enginePhase.mcp,
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

  const { kernel, mcp } = enginePhase;
  const runtime = getAppRuntime();

  const shutdown = async (signal: string) => {
    await gracefulShutdown(
      omitUndefined({
        signal,
        runtime,
        kernel,
        mcp,
        platforms: platformsRef.list,
        cronInitialized,
        http: httpHooks,
        servers,
        waitForDrain: httpHooks?.waitForDrain ?? defaultWaitForDrain,
      }),
    );
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}
