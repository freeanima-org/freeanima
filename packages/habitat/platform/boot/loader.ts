import { pathToFileURL } from "node:url";
import type { Context, Fiber } from "cordis";
import { Loader } from "@cordisjs/plugin-loader";
import Hmr from "@cordisjs/plugin-hmr";
import Timer from "@cordisjs/plugin-timer";

import { mountFeatureService } from "../features/service.ts";
import { REPO_ROOT } from "../service/repo-paths.ts";
import type { BootPipelineConfig } from "./boot-context.ts";

/** `cordis.yml` lists the boot phase plugins; the loader mounts them by name. */
export const BOOT_CONFIG_FILE = "./cordis.yml";

export type BootLoaderOptions = {
  /** Directory the config file (and its relative plugin names) resolve from. */
  baseDir?: string;
  /** Config file path relative to `baseDir`. */
  configPath?: string;
  /** Watch the plugin tree for changes (dev only). */
  hmr?: boolean;
};

/** Handle returned by {@link runBootPipelineViaLoader}, mainly for teardown in tests. */
export type BootLoaderHandle = {
  /** Fiber of the HMR plugin when hot reload is enabled. */
  hmr?: Fiber;
  /** Dispose the HMR watcher and the whole loader tree. */
  dispose: () => Promise<void>;
};

/**
 * Mount the boot pipeline through the official Cordis loader.
 *
 * `bootOptions` is provided up-front so phase plugins can read runtime inputs
 * via `inject`. Set `FREEANIMA_BOOT_HMR=1` to watch the plugin tree (dev only).
 */
export async function runBootPipelineViaLoader(
  ctx: Context,
  pipeline: BootPipelineConfig,
  options: BootLoaderOptions = {},
): Promise<BootLoaderHandle> {
  const baseDir = options.baseDir ?? REPO_ROOT;
  ctx.provide("bootOptions", pipeline);
  // Provided on the root context so every feature plugin in `cordis.yml`
  // (siblings under the loader) can inject it.
  mountFeatureService(ctx);
  ctx.baseUrl = pathToFileURL(baseDir).href + "/";

  const loaderFiber = await ctx.plugin(Loader);
  let hmrFiber: Fiber | undefined;
  if (options.hmr ?? process.env.FREEANIMA_BOOT_HMR === "1") {
    // HMR injects both `loader` and `timer` (it debounces through `ctx.debounce`).
    // Bun lacks loader internals, so source-code HMR stays disabled; what this
    // enables is config-level hot reload of `cordis.yml` via the include plugin,
    // which only starts watching once `hmr` resolves.
    await ctx.plugin(Timer);
    hmrFiber = await ctx.plugin(Hmr, { root: [baseDir], debounce: 100, ignored: [] });
  }
  await ctx.loader.create({
    name: "@cordisjs/plugin-include",
    config: { path: options.configPath ?? BOOT_CONFIG_FILE },
  });
  await ctx.loader.await();

  return {
    ...(hmrFiber ? { hmr: hmrFiber } : {}),
    dispose: async () => {
      await hmrFiber?.dispose();
      await loaderFiber.dispose();
    },
  };
}
