import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { build, type InlineConfig, type Plugin, type Rollup } from "vite";

import { buildViteAliases } from "./module-aliases.ts";
import { shellEntryFileNames } from "./entry-file-names.ts";

export type ShellViteBuildOptions = {
  /** composition 目录（含 index.html） */
  appDir: string;
  outdir: string;
  /** monorepo 根目录（Vite 打包 config 时 import.meta.dir 不可靠） */
  repoRoot?: string;
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
  const repoRoot = opts.repoRoot;
  const indexHtml = join(opts.appDir, "index.html");
  if (!existsSync(indexHtml)) {
    throw new Error(`shell vite: missing ${indexHtml}`);
  }

  const input: Record<string, string> = {
    main: indexHtml,
    ...opts.extraEntries,
  };

  /** Mark Bun runtime built-ins as external — Vite's dep scanner can't resolve them. */
  const bunExternalPlugin: Plugin = {
    name: "bun-external",
    resolveId(id) {
      if (id === "bun" || id.startsWith("bun:")) {
        return { id, external: true };
      }
      return undefined;
    },
  };

  return {
    configFile: false,
    root: opts.appDir,
    base: opts.base ?? "/",
    /**
     * 与 satellite（companion / coding）并行时隔离 optimizeDeps 缓存，
     * 避免共享 `node_modules/.vite` 触发 504 Outdated Optimize Dep。
     */
    cacheDir: `${opts.outdir}-deps`,
    plugins: [bunExternalPlugin, react(), tailwindcss()],
    resolve: {
      alias: repoRoot ? buildViteAliases({ repoRoot }) : [],
      dedupe: ["react", "react-dom"],
    },
    ...(opts.define !== undefined ? { define: opts.define } : {}),
    build: {
      outDir: opts.outdir,
      emptyOutDir: !opts.watch,
      minify: opts.minify ?? false,
      sourcemap: opts.sourcemap ?? false,
      modulePreload: false,
      watch: opts.watch ? {} : null,
      rolldownOptions: {
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

/** Vite 生产/ watch 构建 app-ui 组合应用 */
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
