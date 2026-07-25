import { chdir } from "node:process";
import { omitUndefined } from "@freeanima/host/core/util";
import type { ConversationService } from "@freeanima/host/engine/conversation";
import {
  installErrorLogHandlers,
  logComponent,
  logStartupError,
  markStartupPhase,
} from "@freeanima/host/platform/logging";
import { REPO_ROOT } from "./service/index.ts";
import { DEFAULT_BIND_HOST, coalesceBindHosts, parseBindHosts } from "./bind-hosts.ts";
import { getAppRuntime } from "./service/runtime-context.ts";
import { BOOT_PHASES, startAsyncIntegrations } from "./boot/phases.ts";
import { bootEnginePhase } from "./boot/engine-phase.ts";
import { bootRuntimePhase } from "./boot/runtime-phase.ts";
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
    list: import("@freeanima/host/capabilities/connectors/gateway").PlatformAdapter[];
  } = { list: [] };

  try {
    const configPhase = BOOT_PHASES.find((p) => p.id === "config");
    const persistencePhase = BOOT_PHASES.find((p) => p.id === "persistence");
    if (!configPhase || !persistencePhase) {
      throw new Error("boot phases config/persistence missing");
    }
    await configPhase.run();
    const { config } = await persistencePhase.run();
    const { bootWorldSubjectsPhase } = await import("./boot/world-subjects-phase.ts");
    await bootWorldSubjectsPhase(config);
    const { bootConfigSecretsPhase } = await import("./boot/config-secrets-phase.ts");
    await bootConfigSecretsPhase(config);
    const { bootServiceApiTokensPhase } = await import("./boot/service-api-tokens-phase.ts");
    await bootServiceApiTokensPhase(config);

    const acpSessionUpdatedRef: { handler: ((sid: string) => void) | null } = { handler: null };
    const runtimeRef: { current: AppRuntime | null } = { current: null };

    enginePhase = bootEnginePhase(config, (sid) => {
      acpSessionUpdatedRef.handler?.(sid);
      runtimeRef.current?.pokeSessionWatchers(sid);
    });

    const { runtime } = await bootRuntimePhase(
      enginePhase,
      statusHost,
      port,
      runtimeRef,
      acpSessionUpdatedRef,
    );
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
    await gracefulShutdown(
      omitUndefined({
        signal,
        runtime,
        kernel,
        mcp,
        acp,
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
