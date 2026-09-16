import { pathToFileURL } from "node:url";
import type { Context } from "cordis";
import { Loader } from "@cordisjs/plugin-loader";
import Hmr from "@cordisjs/plugin-hmr";

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
): Promise<void> {
  const baseDir = options.baseDir ?? REPO_ROOT;
  ctx.provide("bootOptions", pipeline);
  ctx.baseUrl = pathToFileURL(baseDir).href + "/";

  await ctx.plugin(Loader);
  if (options.hmr ?? process.env.FREEANIMA_BOOT_HMR === "1") {
    await ctx.plugin(Hmr, { root: [baseDir], debounce: 100, ignored: [] });
  }
  await ctx.loader.create({
    name: "@cordisjs/plugin-include",
    config: { path: options.configPath ?? BOOT_CONFIG_FILE },
  });
  await ctx.loader.await();
}
