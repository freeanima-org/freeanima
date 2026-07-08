import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { createComponentBuildMeta } from "../../../core/config/build-meta.ts";
import { resolveHubRpcWsUrl } from "../../../shared/hub-rpc/urls.ts";

import { shellEntryFileNames } from "../../../frontend/shell-ui/vite/entry-file-names.ts";
import { createShellViteInlineConfig } from "../../../frontend/shell-ui/vite/run-build.ts";
import { shellBridgeHtmlPlugin } from "../../../frontend/shell-ui/vite/shell-bridge-html.ts";

const PKG_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(PKG_DIR, "..", "..", "..", "..");
const SPA_DIR = join(PKG_DIR, "spa");
const DIST_DIR = join(PKG_DIR, "dist");

const HUB_URL = (process.env.FREEANIMA_URL ?? "http://127.0.0.1:2658").replace(/\/$/, "");
const PORT = Number(process.env.WEB_DEV_PORT ?? process.env.SHELL_DEV_PORT ?? 4173);

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
        const path = req.url?.split("?")[0];
        if (path === "/web/config.json") {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          const authToken = process.env.FREEANIMA_REMOTE_AUTH_TOKEN?.trim() ?? "";
          res.end(
            JSON.stringify({
              app_id: "chat",
              hub_url: HUB_URL,
              hub_ws_url: resolveHubRpcWsUrl(HUB_URL),
              ui_version: UI_VERSION,
              web_build: DEV_WEB_BUILD,
              min_shell_version: "0.8.0",
              ...(authToken ? { auth_token: authToken } : {}),
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
          addr && typeof addr === "object" ? addr.port : Number(process.env.WEB_DEV_PORT ?? 4173);
        console.log(
          `[dev:web] Hub ${HUB_URL} · http://127.0.0.1:${port}/web/chat · Console /web/console/dashboard`,
        );
      });
    },
  };
}

function webPwaPlugin(): Plugin[] {
  return VitePWA({
    registerType: "prompt",
    injectRegister: false,
    scope: "/web/",
    base: "/web/",
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
          name: "Console",
          short_name: "Console",
          url: "/web/console/dashboard",
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
    ...(isServe ? { paraglideOutdir: join(REPO_ROOT, "messages", "paraglide") } : {}),
    base: "/web/",
    minify: mode === "production",
    sourcemap: mode !== "production",
    extraEntries: {
      "shell-bridge": join(PKG_DIR, "spa", "shell-bridge.ts"),
    },
    define: {
      __WEB_DEFAULT_HUB_URL__: JSON.stringify(HUB_URL),
      __WEB_DEFAULT_REMOTE_AUTH_TOKEN__: JSON.stringify(
        process.env.FREEANIMA_REMOTE_AUTH_TOKEN ?? "",
      ),
      __WEB_UI_VERSION__: JSON.stringify(UI_VERSION),
    },
  });

  inline.plugins = [...(inline.plugins ?? []), ...webPwaPlugin()];

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

  return mergeConfig(inline, {
    plugins: [webDevPlugin()],
    server: {
      host: "127.0.0.1",
      port: PORT,
      strictPort: false,
      proxy: {
        "/api": { target: HUB_URL, changeOrigin: true },
        "/hub": { target: HUB_URL, changeOrigin: true },
        "/mcp": { target: HUB_URL, changeOrigin: true },
      },
    },
  });
});
