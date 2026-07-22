import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

import { createSatelliteViteInlineConfig } from "../../frontend/shell-ui/vite/satellite-vite.ts";

const PKG_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(PKG_DIR, "..", "..", "..");
const SPA_DIR = join(PKG_DIR, "spa");
const DIST_DIR = join(PKG_DIR, "dist");

export default defineConfig(({ command, mode }) => {
  const isServe = command === "serve";
  return createSatelliteViteInlineConfig({
    appDir: SPA_DIR,
    repoRoot: REPO_ROOT,
    outdir: isServe ? join(PKG_DIR, "node_modules", ".vite-companion") : DIST_DIR,
    // `./`：Electron HTTP 与 Tauri file:// / resource 均可解析 assets
    base: "./",
    minify: mode === "production",
    sourcemap: mode !== "production",
  });
});
