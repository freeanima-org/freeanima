import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig, type Plugin } from "vite";
import { resolveHubWsUrl } from "@freeanima/sap-contract";

import { shellEntryFileNames } from "../../packages/shell-ui/vite/entry-file-names.ts";
import { sapSharedWorkerDevPlugin } from "../../packages/shell-ui/vite/sap-shared-worker-dev-plugin.ts";
import { createShellViteInlineConfig } from "../../packages/shell-ui/vite/run-build.ts";

const PKG_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(PKG_DIR, "..", "..");
const APP_DIR = join(PKG_DIR, "app");
const DIST_DIR = join(PKG_DIR, "dist");

const HUB_URL = (process.env.FREEANIMA_URL ?? "http://127.0.0.1:2658").replace(/\/$/, "");
const PORT = Number(process.env.WEB_DEV_PORT ?? process.env.SHELL_DEV_PORT ?? 4173);

function webDevPlugin(): Plugin {
  return {
    name: "app-web-dev",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split("?")[0];
        if (path === "/config.json") {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(
            JSON.stringify({
              app_id: "chat",
              hub_ws_url: resolveHubWsUrl(HUB_URL),
            }),
          );
          return;
        }
        if (path === "/health") {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ ok: true, app: "chat", mode: "web-dev" }));
          return;
        }
        next();
      });
      server.httpServer?.once("listening", () => {
        const addr = server.httpServer?.address();
        const port =
          addr && typeof addr === "object" ? addr.port : Number(process.env.WEB_DEV_PORT ?? 4173);
        console.log(
          `[dev:web] Hub ${HUB_URL} · http://127.0.0.1:${port}/chat · Admin /admin/dashboard`,
        );
      });
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const isServe = command === "serve";
  const inline = createShellViteInlineConfig({
    appDir: APP_DIR,
    repoRoot: REPO_ROOT,
    outdir: isServe ? join(PKG_DIR, "node_modules", ".vite-app-web") : DIST_DIR,
    paraglideOutdir: isServe ? join(REPO_ROOT, "messages", "paraglide") : undefined,
    base: isServe ? "/" : "./",
    minify: mode === "production",
    sourcemap: mode !== "production",
    extraEntries: {
      "shell-bridge": join(PKG_DIR, "src", "shell-bridge.ts"),
    },
    define: {
      __WEB_DEFAULT_HUB_URL__: JSON.stringify(HUB_URL),
      __WEB_DEFAULT_REMOTE_AUTH_TOKEN__: JSON.stringify(
        process.env.FREEANIMA_REMOTE_AUTH_TOKEN ?? "",
      ),
    },
  });

  if (!isServe) {
    if (inline.build?.rollupOptions?.output && !Array.isArray(inline.build.rollupOptions.output)) {
      inline.build.rollupOptions.output.entryFileNames = (chunkInfo) =>
        shellEntryFileNames(chunkInfo);
    }
    return inline;
  }

  return mergeConfig(inline, {
    plugins: [sapSharedWorkerDevPlugin(REPO_ROOT), webDevPlugin()],
    server: {
      host: "127.0.0.1",
      port: PORT,
      strictPort: false,
      proxy: {
        "/api": { target: HUB_URL, changeOrigin: true },
        "/sap": { target: HUB_URL, changeOrigin: true },
        "/mcp": { target: HUB_URL, changeOrigin: true },
      },
    },
  });
});
