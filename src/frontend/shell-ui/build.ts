import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { runShellViteBuild, type ShellViteBuildOptions } from "./vite/run-build.ts";

const PKG_DIR = import.meta.dir;
const SPA_DIR = join(PKG_DIR, "spa");
const DIST_DIR = join(PKG_DIR, "dist");
const HTML_NAME = "index.html";

export type BuildShellUiOptions = {
  watch?: boolean;
  minify?: boolean;
  sourcemap?: boolean;
  publicPath?: string;
  outdir?: string;
  appDir?: string;
  extraEntries?: Record<string, string>;
  define?: Record<string, string>;
  onRebuild?: (success: boolean) => void | Promise<void>;
};

export async function buildShellUi(opts?: BuildShellUiOptions): Promise<string> {
  const distDir = opts?.outdir ?? DIST_DIR;
  const appDir = opts?.appDir ?? SPA_DIR;

  const viteOpts: ShellViteBuildOptions = {
    appDir,
    outdir: distDir,
    base: opts?.publicPath ?? "/",
    minify: opts?.minify ?? false,
    sourcemap: opts?.sourcemap ?? false,
    ...(opts?.watch !== undefined ? { watch: opts.watch } : {}),
    ...(opts?.extraEntries !== undefined ? { extraEntries: opts.extraEntries } : {}),
    ...(opts?.define !== undefined ? { define: opts.define } : {}),
    ...(opts?.onRebuild !== undefined ? { onRebuild: opts.onRebuild } : {}),
  };

  const out = await runShellViteBuild(viteOpts);

  const html = join(distDir, HTML_NAME);
  if (!opts?.watch) {
    if (!existsSync(html)) throw new Error("build did not produce index.html");
    const content = readFileSync(html, "utf-8");
    if (!content.includes("root")) throw new Error("invalid build output");
  }

  return out;
}

export { createShellViteInlineConfig, runShellViteBuild } from "./vite/run-build.ts";
export { createShellUiAliases } from "./vite/aliases.ts";
