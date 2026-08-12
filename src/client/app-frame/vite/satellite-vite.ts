import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { build, type InlineConfig, type Plugin, type Rollup } from "vite";

import { buildViteAliases } from "./module-aliases.ts";

function satelliteViteDefine(extra?: Record<string, string>): Record<string, string> {
  const viteHabitatWs = process.env.VITE_FREEANIMA_HABITAT_WS ?? "";
  return {
    "process.env.VITE_FREEANIMA_HABITAT_WS": JSON.stringify(viteHabitatWs),
    ...extra,
  };
}

export type SatelliteViteOptions = {
  appDir: string;
  outdir: string;
  repoRoot: string;
  base?: string;
  minify?: boolean;
  sourcemap?: boolean;
  watch?: boolean;
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

export function createSatelliteViteInlineConfig(opts: SatelliteViteOptions): InlineConfig {
  const indexHtml = join(opts.appDir, "index.html");
  if (!existsSync(indexHtml)) {
    throw new Error(`satellite vite: missing ${indexHtml}`);
  }

  const alias = buildViteAliases({ repoRoot: opts.repoRoot });

  const plugins = [
    {
      name: "bun-external",
      resolveId(id: string) {
        if (id === "bun" || id.startsWith("bun:")) {
          return { id, external: true };
        }
        return undefined;
      },
    } satisfies Plugin,
    react(),
    tailwindcss(),
  ];

  return {
    configFile: false,
    root: opts.appDir,
    base: opts.base ?? "/",
    /**
     * web / companion / coding 并行时若共用 `node_modules/.vite`，
     * 一方 re-optimize 会使另一方浏览器拿到 504 Outdated Optimize Dep。
     * outdir 在 serve 下已是各包独立目录（如 `.vite-coding`）。
     */
    cacheDir: `${opts.outdir}-deps`,
    plugins,
    resolve: {
      alias,
      dedupe: ["react", "react-dom"],
    },
    define: satelliteViteDefine(opts.define),
    build: {
      outDir: opts.outdir,
      emptyOutDir: !opts.watch,
      minify: opts.minify ?? false,
      sourcemap: opts.sourcemap ?? false,
      watch: opts.watch ? {} : null,
      rolldownOptions: {
        input: { main: indexHtml },
        output: {
          entryFileNames: "assets/[name]-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]",
        },
      },
    },
    logLevel: "info",
  };
}

export async function runSatelliteViteBuild(opts: SatelliteViteOptions): Promise<string> {
  prepareOutdir(opts.outdir, opts.watch ?? false);
  const config = createSatelliteViteInlineConfig(opts);

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
    throw new Error("satellite vite build did not produce index.html");
  }
  return opts.outdir;
}
