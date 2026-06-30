import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { build, type InlineConfig, type Rollup } from "vite";

import { createShellUiAliases } from "./aliases.ts";
import { shellEntryFileNames } from "./entry-file-names.ts";
import { paraglideCompilePlugin } from "./paraglide-plugin.ts";

export type ShellViteBuildOptions = {
  /** composition 目录（含 index.html） */
  appDir: string;
  outdir: string;
  /** monorepo 根目录（Vite 打包 config 时 import.meta.dir 不可靠） */
  repoRoot?: string;
  /** Paraglide 编译输出目录；默认 outdir/.paraglide */
  paraglideOutdir?: string;
  base?: string;
  minify?: boolean;
  sourcemap?: boolean;
  watch?: boolean;
  /** 额外 Rollup 入口，如 web shell-bridge */
  extraEntries?: Record<string, string>;
  define?: Record<string, string>;
  onRebuild?: (success: boolean) => void | Promise<void>;
};

function prepareOutdir(outdir: string, watch: boolean): void {
  if (!watch) {
    rmSync(outdir, { recursive: true, force: true });
  } else {
    rmSync(join(outdir, "index.html"), { force: true });
  }
  mkdirSync(outdir, { recursive: true });
}

export function createShellViteInlineConfig(opts: ShellViteBuildOptions): InlineConfig {
  const paraglideDir = opts.paraglideOutdir ?? join(opts.outdir, ".paraglide");
  const repoRoot = opts.repoRoot;
  const indexHtml = join(opts.appDir, "index.html");
  if (!existsSync(indexHtml)) {
    throw new Error(`shell vite: missing ${indexHtml}`);
  }

  const input: Record<string, string> = {
    main: indexHtml,
    ...opts.extraEntries,
  };

  return {
    configFile: false,
    root: opts.appDir,
    base: opts.base ?? "/",
    plugins: [paraglideCompilePlugin(paraglideDir, repoRoot), react(), tailwindcss()],
    resolve: {
      alias: createShellUiAliases(paraglideDir, repoRoot),
      dedupe: ["react", "react-dom"],
    },
    ...(opts.define !== undefined ? { define: opts.define } : {}),
    worker: {
      format: "es",
      rollupOptions: {
        output: {
          entryFileNames: "assets/[name]-[hash].js",
        },
      },
    },
    build: {
      outDir: opts.outdir,
      emptyOutDir: !opts.watch,
      minify: opts.minify ?? false,
      sourcemap: opts.sourcemap ?? false,
      modulePreload: false,
      watch: opts.watch ? {} : null,
      rollupOptions: {
        input,
        output: {
          entryFileNames: (chunkInfo) => shellEntryFileNames(chunkInfo),
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]",
        },
      },
    },
    logLevel: "info",
  };
}

/** Vite 生产/ watch 构建 shell-ui 组合应用 */
export async function runShellViteBuild(opts: ShellViteBuildOptions): Promise<string> {
  prepareOutdir(opts.outdir, opts.watch ?? false);

  const config = createShellViteInlineConfig(opts);

  if (opts.watch) {
    const watcher = (await build(config)) as Rollup.RollupWatcher;
    watcher.on("event", (event) => {
      if (event.code === "BUNDLE_END") {
        void opts.onRebuild?.(true);
      }
      if (event.code === "ERROR") {
        void opts.onRebuild?.(false);
      }
    });
    return opts.outdir;
  }

  await build(config);
  const html = join(opts.outdir, "index.html");
  if (!existsSync(html)) {
    throw new Error("shell vite build did not produce index.html");
  }
  return opts.outdir;
}
