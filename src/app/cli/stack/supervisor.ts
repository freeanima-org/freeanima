import { logStartupError } from "@freeanima/platform/logging";
import { isBootstrapWebHostingEnabled } from "@freeanima/core/config";
import { loadBootstrapConfig } from "@freeanima/platform/config/bootstrap.ts";
import { parseBindHosts } from "@freeanima/platform";
import {
  resolveHubTlsListenConfig,
  toHubTlsBunOptions,
} from "@freeanima/platform/tls/resolve-hub-tls";

import { tryResolveWebDistDir } from "../web/dist-path.ts";

export type ServiceStackOptions = {
  host: string;
  port: number;
};

/** Hub 就绪后打印 Web 托管提示（无 sidecar） */
async function onHubReady(hubPort: number): Promise<void> {
  const bootstrap = loadBootstrapConfig();
  if (isBootstrapWebHostingEnabled(bootstrap)) {
    console.log(`[stack] Web UI http://127.0.0.1:${hubPort}/web/chat（由 Hub 托管）`);
  }
}

/** Hub foreground（Web 静态由 Hub /web 托管） */
export async function runServiceStack(options: ServiceStackOptions): Promise<void> {
  const bootstrap = loadBootstrapConfig();
  const webEnabled = isBootstrapWebHostingEnabled(bootstrap);
  const bootstrapHttp = bootstrap.http;

  let webStatic: {
    distDir: string;
    appId?: string;
    uiVersion?: string;
    minShellVersion?: string;
  } | null = null;
  if (webEnabled) {
    try {
      // 启动从不自动 build：源码部署须先 bun run build:web；standalone 打包时已嵌入
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
        console.warn(
          "[stack] config.yaml web.enabled 已开启（或缺省开启）但未找到 Web dist，Hub 将不托管 /web（请先 bun run build:web）",
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
      void onHubReady(options.port);
      if (tlsListen) {
        console.log(
          `[stack] Hub HTTPS https://127.0.0.1:${tlsListen.port}（TLS 证书：${tlsListen.material.source}）`,
        );
      }
    },
  });
}
