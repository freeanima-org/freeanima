import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { defineConfig, mergeConfig, type Plugin } from "vite";

import { createSatelliteViteInlineConfig } from "../../packages/shell-ui/vite/satellite-vite.ts";

const PKG_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(PKG_DIR, "..", "..");
const APP_DIR = join(PKG_DIR, "app");
const DIST_DIR = join(PKG_DIR, "dist");

const API_PORT = Number(process.env.SATELLITE_PORT ?? 4173);
const UI_PORT = Number(process.env.SATELLITE_UI_PORT ?? process.env.VITE_DEV_PORT ?? 5173);

function pairSidecarApiPlugin(): Plugin {
  return {
    name: "pair-sidecar-api",
    async configureServer() {
      process.env.SATELLITE_VITE_DEV = "1";
      await import(pathToFileURL(join(PKG_DIR, "server/index.ts")).href);
    },
  };
}

function pairDevPlugin(): Plugin {
  return {
    name: "pair-programming-dev",
    configureServer() {
      console.log(
        `[dev:pair] UI HMR http://127.0.0.1:${UI_PORT} · API http://127.0.0.1:${API_PORT}`,
      );
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const isServe = command === "serve";
  const inline = createSatelliteViteInlineConfig({
    appDir: APP_DIR,
    repoRoot: REPO_ROOT,
    outdir: isServe ? join(PKG_DIR, "node_modules", ".vite-pair") : DIST_DIR,
    base: "/",
    minify: mode === "production",
    sourcemap: mode !== "production",
    paraglide: true,
    aliases: [{ find: /^@pair\/(.*)$/, replacement: `${join(APP_DIR, "src")}/$1` }],
  });

  if (!isServe) {
    return inline;
  }

  const target = `http://127.0.0.1:${API_PORT}`;
  return mergeConfig(inline, {
    plugins: [pairSidecarApiPlugin(), pairDevPlugin()],
    server: {
      host: "127.0.0.1",
      port: UI_PORT,
      strictPort: false,
      proxy: {
        "/sap": { target, ws: true, changeOrigin: true },
        "/api": { target, changeOrigin: true },
        "/config.json": { target, changeOrigin: true },
        "/health": { target, changeOrigin: true },
      },
    },
  });
});
