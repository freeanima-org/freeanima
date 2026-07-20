import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig, type Plugin } from "vite";

import {
  createHabitatDevProxyMap,
  createShellViteInlineConfig,
  quietBenignWsProxyErrorsPlugin,
  resolveProxyHabitatUrl,
} from "../vite-config-imports.ts";

const PKG_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(PKG_DIR, "..", "..", "..", "..");
const SPA_DIR = join(PKG_DIR, "spa");
const PROXY_HABITAT = resolveProxyHabitatUrl();
const HUB_URL = PROXY_HABITAT.url;
const PORT = Number(process.env.DESKTOP_SHELL_VITE_PORT ?? 5173);

function desktopDevPlugin(): Plugin {
  return {
    name: "app-desktop-dev",
    configureServer() {
      console.log(
        `[dev:desktop] shell HMR http://127.0.0.1:${PORT} · Habitat ${HUB_URL} (${PROXY_HABITAT.source})`,
      );
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const isServe = command === "serve";
  const inline = createShellViteInlineConfig({
    appDir: SPA_DIR,
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
    plugins: [quietBenignWsProxyErrorsPlugin(), desktopDevPlugin()],
    server: {
      host: "127.0.0.1",
      port: PORT,
      strictPort: false,
      proxy: createHabitatDevProxyMap(HUB_URL, ["/sap"]),
    },
  });
});
