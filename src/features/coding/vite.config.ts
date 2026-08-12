import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

import { createSatelliteViteInlineConfig } from "../../client/app-frame/vite/satellite-vite.ts";

const PKG_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(PKG_DIR, "..", "..", "..");
const SPA_DIR = join(PKG_DIR, "ui", "spa");
const DIST_DIR = join(PKG_DIR, "dist");

export default defineConfig(({ command, mode }) => {
  const isServe = command === "serve";
  const base = createSatelliteViteInlineConfig({
    appDir: SPA_DIR,
    repoRoot: REPO_ROOT,
    outdir: isServe ? join(PKG_DIR, "node_modules", ".vite-coding") : DIST_DIR,
    base: "./",
    minify: mode === "production",
    sourcemap: mode !== "production",
  });
  return {
    ...base,
    server: {
      ...base.server,
      host: "127.0.0.1",
      port: 4186,
      strictPort: true,
    },
  };
});
