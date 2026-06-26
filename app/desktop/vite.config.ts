import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig, type Plugin } from "vite";

import { createShellViteInlineConfig } from "../../packages/shell-ui/vite/run-build.ts";

const PKG_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(PKG_DIR, "..", "..");
const APP_DIR = join(PKG_DIR, "app");
const HUB_URL = (process.env.FREEANIMA_URL ?? "http://127.0.0.1:2658").replace(/\/$/, "");
const PORT = Number(process.env.DESKTOP_SHELL_VITE_PORT ?? 5173);

function desktopDevPlugin(): Plugin {
  return {
    name: "app-desktop-dev",
    configureServer() {
      console.log(`[dev:desktop] shell HMR http://127.0.0.1:${PORT} · Hub ${HUB_URL}`);
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const isServe = command === "serve";
  const inline = createShellViteInlineConfig({
    appDir: APP_DIR,
    repoRoot: REPO_ROOT,
    outdir: isServe
      ? join(PKG_DIR, "node_modules", ".vite-desktop")
      : join(PKG_DIR, "vendor", "shell-ui", "dist"),
    base: "/",
    minify: mode === "production",
    sourcemap: mode !== "production",
  });

  if (!isServe) {
    return inline;
  }

  return mergeConfig(inline, {
    plugins: [desktopDevPlugin()],
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
