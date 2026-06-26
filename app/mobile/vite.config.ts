import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

import { createShellViteInlineConfig } from "../../packages/shell-ui/vite/run-build.ts";
import { shellEntryFileNames } from "../../packages/shell-ui/vite/entry-file-names.ts";

import { arrangeMobileIndexHtml } from "./mobile-html.ts";

const PKG_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(PKG_DIR, "..", "..");
const APP_DIR = join(PKG_DIR, "app");
const DIST_DIR = join(PKG_DIR, "www");

const debug = process.env.MOBILE_DEBUG === "1" || process.argv.includes("--debug");

function mobileHtmlPlugin(outdir: string): Plugin {
  return {
    name: "app-mobile-html",
    closeBundle() {
      const indexPath = join(outdir, "index.html");
      const html = readFileSync(indexPath, "utf-8");
      writeFileSync(indexPath, arrangeMobileIndexHtml(html));
    },
  };
}

export default defineConfig(() => {
  const inline = createShellViteInlineConfig({
    appDir: APP_DIR,
    repoRoot: REPO_ROOT,
    outdir: DIST_DIR,
    base: "./",
    minify: !debug,
    sourcemap: debug,
    extraEntries: {
      "shell-bridge": join(PKG_DIR, "src", "shell-bridge.ts"),
    },
    define: {
      __MOBILE_DEBUG__: JSON.stringify(debug),
    },
  });

  inline.plugins = [...(inline.plugins ?? []), mobileHtmlPlugin(DIST_DIR)];

  if (inline.build?.rollupOptions?.output && !Array.isArray(inline.build.rollupOptions.output)) {
    inline.build.rollupOptions.output.entryFileNames = (chunkInfo) =>
      shellEntryFileNames(chunkInfo);
  }

  return inline;
});
