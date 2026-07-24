import { logStartupError } from "@freeanima/platform/logging";
import { loadBootstrapConfig } from "@freeanima/platform/config/bootstrap.ts";
import { parseBindHosts } from "@freeanima/platform";
import {
  resolveHabitatTlsListenConfig,
  toHabitatTlsBunOptions,
} from "@freeanima/platform/tls/resolve-habitat-tls";

import { tryResolveWebDistDir } from "../web/dist-path.ts";

export type ServiceStackOptions = {
  host: string;
  port: number;
  /**
   * 为 true 时跳过 Habitat TLS listen（即使 config.yaml http.tls.enabled）。
   * 源码 `dev:habitat` 使用：HTTPS 由 Vite 终止，Habitat 只听明文高位口。
   */
  skipTls?: boolean;
};

/** Habitat 就绪后打印 Web 托管提示（无 sidecar） */
async function onHubReady(hubPort: number, webHostedByHub: boolean): Promise<void> {
  if (webHostedByHub) {
    console.log(`[stack] Web UI http://127.0.0.1:${hubPort}/web/chat（由 Habitat 托管）`);
  }
}

/** Habitat foreground（Web 静态由 Habitat /web 托管；dev:habitat skipTls 时改由 Vite） */
export async function runServiceStack(options: ServiceStackOptions): Promise<void> {
  const bootstrap = loadBootstrapConfig();
  const bootstrapHttp = bootstrap.http;
  /**
   * 源码 `dev:habitat`（skipTls）：Habitat 不托管 dist，
   * UI 由 `dev:web`（Vite :5000，可 HTTPS）提供；与 http 侧 skipTls 对称。
   */
  const webEnabled = !options.skipTls;
  if (options.skipTls) {
    console.log("[stack] skipTls/dev-habitat：Habitat 不托管 /web（UI 由 Vite WEB_DEV_PORT 提供）");
  }

  let webStatic: {
    distDir: string;
    appId?: string;
    uiVersion?: string;
    minShellVersion?: string;
  } | null = null;
  if (webEnabled) {
    try {
      // 启动从不自动 build：源码部署须先 just pack web；standalone 打包时已嵌入
      const distDir = tryResolveWebDistDir();
      if (distDir) {
        let uiVersion: string | undefined;
        try {
          const { readAppVersion } = await import("@freeanima/core/config/version");
          uiVersion = readAppVersion().trim();
        } catch {
          /* ignore */
        }
        webStatic = {
          distDir,
          appId: "chat",
          ...(uiVersion ? { uiVersion } : {}),
          minShellVersion: "0.8.0",
        };
      } else {
        console.warn("[stack] 未找到 Web dist，Habitat 将不托管 /web（请先 just pack web）");
      }
    } catch (err) {
      logStartupError("[stack] Web dist 解析失败，继续启动 Habitat（不托管 /web）", err);
      webStatic = null;
    }
  }

  const { serve } = await import("@freeanima/platform");
  const { startHubHttpServers, closeHttpServers, waitForDrainWithTimeout } =
    await import("@freeanima/features/habitat/habitat/habitat-api");

  const bindHosts = parseBindHosts(options.host);
  const tlsListen = options.skipTls
    ? null
    : await resolveHabitatTlsListenConfig(bootstrapHttp, bindHosts);
  if (options.skipTls && bootstrapHttp?.tls?.enabled) {
    console.log("[stack] skipTls：不绑 Habitat TLS（开发由 Vite HTTPS 终止；Habitat 仅明文 HTTP）");
  }

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
                  tls: toHabitatTlsBunOptions(resolvedTls.material),
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
      void onHubReady(options.port, webStatic != null);
      if (tlsListen) {
        console.log(
          `[stack] Habitat HTTPS https://127.0.0.1:${tlsListen.port}（TLS 证书：${tlsListen.material.source}）`,
        );
      }
    },
  });
}
