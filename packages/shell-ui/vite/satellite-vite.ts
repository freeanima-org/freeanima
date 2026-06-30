import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { build, type Alias, type InlineConfig, type Rollup } from "vite";

import { paraglideCompilePlugin } from "./paraglide-plugin.ts";

export type SatelliteViteOptions = {
  appDir: string;
  outdir: string;
  repoRoot: string;
  base?: string;
  minify?: boolean;
  sourcemap?: boolean;
  watch?: boolean;
  aliases?: Alias[];
  /** 编译 messages/paraglide 到 outdir/.paraglide */
  paraglide?: boolean;
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
  const paraglideDir = join(opts.outdir, ".paraglide");
  const indexHtml = join(opts.appDir, "index.html");
  if (!existsSync(indexHtml)) {
    throw new Error(`satellite vite: missing ${indexHtml}`);
  }

  const alias: Alias[] = [...(opts.aliases ?? [])];
  if (opts.paraglide) {
    alias.push({ find: /^(.*)messages\/paraglide\/(.*)$/, replacement: `${paraglideDir}/$2` });
  }

  const plugins = [];
  if (opts.paraglide) {
    plugins.push(paraglideCompilePlugin(paraglideDir, opts.repoRoot));
  }
  plugins.push(react(), tailwindcss());

  return {
    configFile: false,
    root: opts.appDir,
    base: opts.base ?? "/",
    plugins,
    resolve: {
      alias,
      dedupe: ["react", "react-dom"],
    },
    ...(opts.define !== undefined ? { define: opts.define } : {}),
    build: {
      outDir: opts.outdir,
      emptyOutDir: !opts.watch,
      minify: opts.minify ?? false,
      sourcemap: opts.sourcemap ?? false,
      watch: opts.watch ? {} : null,
      rollupOptions: {
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
