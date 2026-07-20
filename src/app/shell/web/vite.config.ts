import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { createComponentBuildMeta } from "../vite-config-imports.ts";
import {
  createHabitatDevProxyMap,
  createShellViteInlineConfig,
  quietBenignWsProxyErrorsPlugin,
  resolveProxyHabitatUrl,
  shellBridgeHtmlPlugin,
  shellEntryFileNames,
} from "../vite-config-imports.ts";
import {
  DEFAULT_WEB_DEV_PORT,
  readDevWebTokenPlaintext,
  resolveDevWebHttps,
  shouldEnableDevWebHttps,
} from "./dev-https.ts";

const PKG_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(PKG_DIR, "..", "..", "..", "..");
const SPA_DIR = join(PKG_DIR, "spa");
const DIST_DIR = join(PKG_DIR, "dist");

const PROXY_HABITAT = resolveProxyHabitatUrl();
/** 仅 Vite proxy 目标；浏览器 hub_url 用页面 origin */
const PROXY_HABITAT_URL = PROXY_HABITAT.url;
const PORT = Number(process.env.WEB_DEV_PORT ?? process.env.SHELL_DEV_PORT ?? DEFAULT_WEB_DEV_PORT);

function readUiVersion(): string {
  try {
    const rootPkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf-8")) as {
      version?: string;
    };
    return rootPkg.version?.trim() || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const UI_VERSION = readUiVersion();

function devWebBuildMeta() {
  return createComponentBuildMeta({
    component: "web",
    channel: "dev",
    repoRoot: REPO_ROOT,
    version: UI_VERSION,
    includeBuiltAt: true,
  });
}

const DEV_WEB_BUILD = devWebBuildMeta();

function webDevPlugin(): Plugin {
  return {
    name: "app-web-dev",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split("?")[0] ?? "";
        // Legacy Console → Habitat（dev SPA 入口）
        if (path === "/web/console" || path.startsWith("/web/console/")) {
          const rest = path.slice("/web/console".length) || "/dashboard";
          const suffix = rest === "/" ? "/dashboard" : rest;
          const qs = req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
          res.statusCode = 302;
          res.setHeader("Location", `/web/habitat${suffix}${qs}`);
          res.end();
          return;
        }
        if (path === "/web/config.json") {
          const token = readDevWebTokenPlaintext();
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.end(
            JSON.stringify({
              app_id: "chat",
              // 空 = 浏览器用 location.origin（经 Vite /hub proxy）
              hub_url: "",
              hub_ws_url: "",
              ui_version: UI_VERSION,
              web_build: DEV_WEB_BUILD,
              min_shell_version: "0.8.0",
              ...(token ? { remote_auth_token: token } : {}),
            }),
          );
          return;
        }
        if (path === "/web/health") {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ ok: true, app: "web", mode: "web-dev" }));
          return;
        }
        next();
      });
      server.httpServer?.once("listening", () => {
        const addr = server.httpServer?.address();
        const port =
          addr && typeof addr === "object"
            ? addr.port
            : Number(process.env.WEB_DEV_PORT ?? DEFAULT_WEB_DEV_PORT);
        const httpsOn = Boolean(server.config.server.https);
        const scheme = httpsOn ? "https" : "http";
        console.log(
          `[dev:web] proxy→${PROXY_HABITAT_URL} (${PROXY_HABITAT.source}) · ${scheme}://127.0.0.1:${port}/web/chat · Habitat /web/habitat/dashboard`,
        );
        if (PROXY_HABITAT.source === "default") {
          console.warn(
            "[dev:web] FREEANIMA_URL unset and no server.status.json — proxy defaults to http://127.0.0.1:2658; set FREEANIMA_URL or run just dev / dev:hub",
          );
        } else if (PROXY_HABITAT.source === "status") {
          console.info(
            "[dev:web] FREEANIMA_URL unset; using Habitat port from ~/.anima/server.status.json",
          );
        }
      });
    },
  };
}

function webPwaPlugin(options?: { disable?: boolean }): Plugin[] {
  const skipPwa = Boolean(options?.disable) || process.env.FREEANIMA_WEB_SKIP_PWA === "1";
  return VitePWA({
    disable: skipPwa,
    registerType: "prompt",
    injectRegister: false,
    scope: "/web/",
    base: "/web/",
    // 开发 serve 已整插件 disable；保留 false 防止误开
    devOptions: {
      enabled: false,
    },
    manifest: {
      id: "/web/",
      name: "FreeAnima",
      short_name: "FreeAnima",
      description: "FreeAnima Web UI",
      start_url: "/web/chat",
      scope: "/web/",
      display: "standalone",
      theme_color: "#0a0a0b",
      background_color: "#0a0a0b",
      icons: [
        { src: "/web/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        {
          src: "/web/icons/icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/web/icons/icon-512-maskable.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
      shortcuts: [
        {
          name: "Chat",
          short_name: "Chat",
          url: "/web/chat",
          icons: [{ src: "/web/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
        },
        {
          name: "Habitat",
          short_name: "Habitat",
          url: "/web/habitat/dashboard",
          icons: [{ src: "/web/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
        },
      ],
    },
    workbox: {
      navigateFallback: "/web/index.html",
      navigateFallbackDenylist: [/^\/web\/config\.json$/],
      globPatterns: ["**/*.{js,css,html,woff2,svg,png,ico,webmanifest}"],
      runtimeCaching: [],
    },
  });
}

export default defineConfig(({ command, mode }) => {
  const isServe = command === "serve";
  const inline = createShellViteInlineConfig({
    appDir: SPA_DIR,
    repoRoot: REPO_ROOT,
    outdir: isServe ? join(PKG_DIR, "node_modules", ".vite-app-web") : DIST_DIR,
    paraglideOutdir: join(REPO_ROOT, "messages", "paraglide"),
    base: "/web/",
    minify: mode === "production",
    sourcemap: mode !== "production",
    extraEntries: {
      "shell-bridge": join(PKG_DIR, "spa", "shell-bridge.ts"),
    },
    define: {
      // Web 默认同源；编译期常量仅作极端回退（Electron 等非 Web 路径）
      __WEB_DEFAULT_HUB_URL__: JSON.stringify(""),
      __WEB_UI_VERSION__: JSON.stringify(UI_VERSION),
    },
  });

  // 开发 serve 禁用 PWA，避免历史 SW 缓存旧 JS（HMR 被劫持）
  const skipPwa = isServe || process.env.FREEANIMA_WEB_SKIP_PWA === "1";
  inline.plugins = [...(inline.plugins ?? []), ...webPwaPlugin({ disable: skipPwa })];
  if (skipPwa) {
    console.info(
      isServe
        ? "[dev:web] VitePWA disabled (dev serve — no SW)"
        : "[build:web] FREEANIMA_WEB_SKIP_PWA=1 — VitePWA disabled",
    );
  }

  if (!isServe) {
    if (
      inline.build?.rolldownOptions?.output &&
      !Array.isArray(inline.build.rolldownOptions.output)
    ) {
      inline.build.rolldownOptions.output.entryFileNames = (chunkInfo) =>
        shellEntryFileNames(chunkInfo);
    }
    inline.plugins = [...(inline.plugins ?? []), shellBridgeHtmlPlugin(DIST_DIR, "/web/")];
    return inline;
  }

  const https = resolveDevWebHttps();
  if (shouldEnableDevWebHttps() && !https) {
    console.warn(
      "[dev:web] http.tls / DEV_HTTPS 已启用但缺少 ~/.anima/tls/{cert,key}.pem — 以 HTTP 启动",
    );
  }

  return mergeConfig(inline, {
    plugins: [quietBenignWsProxyErrorsPlugin(), webDevPlugin()],
    server: {
      host: "0.0.0.0",
      port: PORT,
      strictPort: false,
      allowedHosts: true,
      ...(https ? { https } : {}),
      proxy: createHabitatDevProxyMap(PROXY_HABITAT_URL),
    },
  });
});
