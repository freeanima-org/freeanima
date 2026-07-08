import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

import { nativeBuildMetaDefine } from "../../../frontend/shell-sdk/native-build-meta.ts";
import { resolveNativeBuildMeta } from "../shared/resolve-native-build-meta.ts";
import type { ComponentBuildMeta } from "../../../core/config/build-meta.ts";
import { createShellViteInlineConfig } from "../../../frontend/shell-ui/vite/run-build.ts";
import { shellEntryFileNames } from "../../../frontend/shell-ui/vite/entry-file-names.ts";

const PKG_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(PKG_DIR, "..", "..", "..", "..");
const SPA_DIR = join(PKG_DIR, "bootstrap");
const DIST_DIR = join(PKG_DIR, "www");

const debug = process.env.MOBILE_DEBUG === "1" || process.argv.includes("--debug");

const nativeBuildMeta = resolveNativeBuildMeta({
  shell: "mobile",
  channel: debug ? "dev" : "prod",
  repoRoot: REPO_ROOT,
});

function writeNativeBuildMetaAsset(meta: ComponentBuildMeta): Plugin {
  return {
    name: "mobile-native-build-meta-asset",
    closeBundle() {
      writeFileSync(join(DIST_DIR, "native-build-meta.json"), `${JSON.stringify(meta)}\n`, "utf8");
    },
  };
}

export default defineConfig(() => {
  const inline = createShellViteInlineConfig({
    appDir: SPA_DIR,
    repoRoot: REPO_ROOT,
    outdir: DIST_DIR,
    base: "./",
    minify: !debug,
    sourcemap: debug,
    define: nativeBuildMetaDefine(nativeBuildMeta),
  });

  inline.plugins = [...(inline.plugins ?? []), writeNativeBuildMetaAsset(nativeBuildMeta)];

  if (
    inline.build?.rolldownOptions?.output &&
    !Array.isArray(inline.build.rolldownOptions.output)
  ) {
    inline.build.rolldownOptions.output.entryFileNames = (chunkInfo) =>
      shellEntryFileNames(chunkInfo);
  }

  return inline;
});
