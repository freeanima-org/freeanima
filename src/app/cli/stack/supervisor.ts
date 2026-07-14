import type { ChildProcess } from "node:child_process";
import { join } from "node:path";
import { logStartupError } from "@freeanima/platform/logging";
import { loadRuntimeConfigSection } from "@freeanima/platform/config";
import { loadBootstrapConfig } from "@freeanima/platform/config/bootstrap.ts";
import { parseBindHosts } from "@freeanima/platform";
import {
  resolveHubTlsListenConfig,
  toHubTlsBunOptions,
} from "@freeanima/platform/tls/resolve-hub-tls";
import { systemdUserAvailable } from "../systemd-unit.ts";

import { getRepoRoot } from "@freeanima/core/config/repo-root";
import { tryResolveWebDistDir } from "../web/dist-path.ts";
import {
  findCloudflaredPidOnHost,
  startTunnelForStack,
  stopTunnelForeground,
} from "../tunnel/tunnel-supervisor.ts";

export type ServiceStackOptions = {
  host: string;
  port: number;
};

type StackSidecars = {
  tunnel: ChildProcess | null;
};

let sidecars: StackSidecars = { tunnel: null };
let shuttingDown = false;

async function stopStackSidecars(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  stopTunnelForeground();
  sidecars.tunnel = null;
}

async function startStackSidecars(hubPort: number): Promise<void> {
  const webCfg = await loadRuntimeConfigSection<{ enabled?: boolean }>("web");
  const tunnelCfg = await loadRuntimeConfigSection<{ enabled?: boolean }>("tunnel");

  if (webCfg?.enabled) {
    console.log(`[stack] Web UI http://127.0.0.1:${hubPort}/web/chat（由 Hub 托管）`);
  }

  if (tunnelCfg?.enabled) {
    sidecars.tunnel = await startTunnelForStack();
    if (sidecars.tunnel) {
      sidecars.tunnel.on("exit", (code, signal) => {
        if (shuttingDown) return;
        console.warn(`[stack] cloudflared 退出 code=${code ?? "?"} signal=${signal ?? ""}`);
        sidecars.tunnel = null;
        if (!shuttingDown && tunnelCfg?.enabled) {
          void startTunnelForStack().then((child) => {
            sidecars.tunnel = child;
          });
        }
      });
    } else if (findCloudflaredPidOnHost() == null && !systemdUserAvailable()) {
      console.warn("[stack] cloudflared 侧车未启动（见上方日志或 error.log）");
    }
  }
}

/** Hub foreground + optional Tunnel 侧车（Web 静态由 Hub /web 托管） */
export async function runServiceStack(options: ServiceStackOptions): Promise<void> {
  sidecars = { tunnel: null };
  shuttingDown = false;

  const onStop = (): void => {
    void stopStackSidecars();
  };
  process.once("SIGINT", onStop);
  process.once("SIGTERM", onStop);

  const webCfg = await loadRuntimeConfigSection<{ enabled?: boolean }>("web");
  const bootstrapHttp = loadBootstrapConfig().http;

  let webStatic: {
    distDir: string;
    appId?: string;
    uiVersion?: string;
    minShellVersion?: string;
  } | null = null;
  if (webCfg?.enabled) {
    try {
      // 启动从不自动 build：源码部署须先 bun run build:web；standalone 打包时已嵌入
      const distDir = tryResolveWebDistDir();
      if (distDir) {
        let uiVersion: string | undefined;
        try {
          const rootPkg = JSON.parse(
            await Bun.file(join(getRepoRoot(), "package.json")).text(),
          ) as { version?: string };
          uiVersion = rootPkg.version?.trim();
        } catch {
          /* standalone 等形态可能无 package.json 版本字段 */
        }
        webStatic = {
          distDir,
          appId: "chat",
          ...(uiVersion ? { uiVersion } : {}),
          minShellVersion: "0.8.0",
        };
      } else {
        console.warn(
          "[stack] web.enabled 但未找到 Web dist，Hub 将不托管 /web（请先 bun run build:web）",
        );
      }
    } catch (err) {
      logStartupError("[stack] Web dist 解析失败，继续启动 Hub（不托管 /web）", err);
      webStatic = null;
    }
  }

  const { serve } = await import("@freeanima/platform");
  const { startHubHttpServers, closeHttpServers, waitForDrainWithTimeout } =
    await import("@freeanima/features/console/hub/console-api");

  const bindHosts = parseBindHosts(options.host);
  const tlsListen = await resolveHubTlsListenConfig(bootstrapHttp, bindHosts);

  await serve(options.host, options.port, {
    foreground: true,
    ...(tlsListen ? { httpListen: { tls: tlsListen } } : {}),
    http: {
      start: async (hosts, port, listenOpts) => {
        const resolvedTls = listenOpts?.tls ?? tlsListen;
        const result = await startHubHttpServers(hosts, port, {
          webStatic,
          ...(resolvedTls
            ? {
                tlsListen: {
                  port: resolvedTls.port,
                  tls: toHubTlsBunOptions(resolvedTls.material),
                },
              }
            : {}),
        });
        return { handles: result.handles, tlsPort: result.tlsPort };
      },
      close: closeHttpServers,
      waitForDrain: waitForDrainWithTimeout,
    },
    onReady: () => {
      void startStackSidecars(options.port);
      if (tlsListen) {
        console.log(
          `[stack] Hub HTTPS https://127.0.0.1:${tlsListen.port}（TLS 证书：${tlsListen.material.source}）`,
        );
      }
    },
  });

  await stopStackSidecars();
}

/** 测试用：重置侧车状态 */
export function resetStackSidecarsForTests(): void {
  sidecars = { tunnel: null };
  shuttingDown = false;
}
