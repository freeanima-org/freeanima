import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

import { createSatelliteViteInlineConfig } from "../../packages/shell-ui/vite/satellite-vite.ts";

const PKG_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(PKG_DIR, "..", "..");
const APP_DIR = join(PKG_DIR, "app");
const DIST_DIR = join(PKG_DIR, "dist");

export default defineConfig(({ command, mode }) => {
  const isServe = command === "serve";
  return createSatelliteViteInlineConfig({
    appDir: APP_DIR,
    repoRoot: REPO_ROOT,
    outdir: isServe ? join(PKG_DIR, "node_modules", ".vite-companion") : DIST_DIR,
    base: "/",
    minify: mode === "production",
    sourcemap: mode !== "production",
    aliases: [
      { find: /^@\/(.*)$/, replacement: `${join(APP_DIR, "src")}/$1` },
      { find: /^@shared\/(.*)$/, replacement: `${join(PKG_DIR, "shared")}/$1` },
    ],
  });
});
