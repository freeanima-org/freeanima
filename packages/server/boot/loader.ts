import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Context, Fiber } from "cordis";
import { Loader } from "@cordisjs/plugin-loader";
import Hmr from "@cordisjs/plugin-hmr";
import Timer from "@cordisjs/plugin-timer";
import { isStandaloneExecutable } from "@freeanima/core/config/cli-install";

import { mountFeatureService } from "../features/service.ts";
import { REPO_ROOT } from "../service/repo-paths.ts";
import type { BootPipelineConfig } from "./boot-context.ts";

/** `cordis.yml` lists the boot phase plugins; the loader mounts them by name. */
export const BOOT_CONFIG_FILE = "./cordis.yml";

/** 清单 `- name: <path>` 列出的插件路径（与 check-boot-plugin-parity 相同的简单列表格式）。 */
function declaredPluginNames(absConfigPath: string): string[] {
  if (!existsSync(absConfigPath)) return [];
  return [...readFileSync(absConfigPath, "utf8").matchAll(/^\s*-\s*name:\s*(\S+)\s*$/gm)]
    .map((match) => match[1])
    .filter((name): name is string => name !== undefined);
}

function resolveConfigPath(baseDir: string, configPath: string): string {
  return isAbsolute(configPath) ? configPath : resolve(baseDir, configPath);
}

/** 缺失的 include 路径不会让 loader 报错，只会让插件树为空；提前给出可诊断的错误。 */
function assertBootConfigExists(baseDir: string, configPath: string): void {
  const abs = resolveConfigPath(baseDir, configPath);
  if (existsSync(abs)) return;
  throw new Error(
    `boot 插件树清单不存在: ${abs}（baseDir=${baseDir}）。` +
      `请在仓库根运行，或设置 FREEANIMA_REPO_ROOT；缺失时启动流水线不会执行任何阶段。`,
  );
}

/**
 * 插件树为空 / 清单里的插件未挂载时立即失败：loader 对导入失败的条目只记日志，
 * 调用方随后才以 “Cannot destructure property 'runtime'” 崩掉。
 * 只比对清单实际列出的名字，自定义配置（测试里的探针插件）同样受保护。
 */
function assertBootPhasesMounted(ctx: Context, baseDir: string, configPath: string): void {
  const abs = resolveConfigPath(baseDir, configPath);
  const entries = [...(ctx.loader.entries?.() ?? [])];
  const byName = new Map(entries.map((entry) => [entry.options.name, entry]));
  const declared = declaredPluginNames(abs);
  // 导入失败的条目只记日志、不建 fiber：同样算未挂载。
  const unmounted = declared.filter((name) => byName.get(name)?.fiber == null);
  // 只剩 include 自身说明清单一条都没生效。
  const mountedCount = entries.filter((entry) => entry.fiber != null).length;
  if (unmounted.length === 0 && mountedCount > 1) return;
  throw new Error(
    `boot 插件树未挂载: ${abs} 列出 ${String(declared.length)} 项、成功挂载 ${String(mountedCount)} 项` +
      (unmounted.length > 0 ? `；未挂载 ${unmounted.join(", ")}` : "；清单可能为空") +
      `。启动流水线不会继续。`,
  );
}

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
 * `bun build --compile` 单文件产物没有磁盘上的 `packages/**` 源码树：`cordis.yml`
 * 里的 TS 插件路径无法在运行期 `import()`。这类产物的插件树已在编译期静态内联，
 * 直接挂载 `phases.ts` 的清单即可（同一份插件，由 check-boot-plugin-parity 与
 * `cordis.yml` 保持一致）。
 */
async function runEmbeddedBootPipeline(
  ctx: Context,
  pipeline: BootPipelineConfig,
): Promise<BootLoaderHandle> {
  const { runBootPipeline } = await import("./phases.ts");
  const fibers = await runBootPipeline(ctx, pipeline);
  return {
    dispose: async () => {
      for (const fiber of fibers.toReversed()) await fiber.dispose();
    },
  };
}

/**
 * Mount the boot pipeline through the official Cordis loader.
 *
 * `bootOptions` is provided up-front so phase plugins can read runtime inputs
 * via `inject`. Set `FREEANIMA_BOOT_HMR=1` to watch the plugin tree (dev only).
 *
 * Compiled standalone binaries take {@link runEmbeddedBootPipeline} instead:
 * they ship no `packages/**` source tree to resolve `cordis.yml` names against.
 */
export async function runBootPipelineViaLoader(
  ctx: Context,
  pipeline: BootPipelineConfig,
  options: BootLoaderOptions = {},
): Promise<BootLoaderHandle> {
  const baseDir = options.baseDir ?? REPO_ROOT;
  const configPath = options.configPath ?? BOOT_CONFIG_FILE;
  // standalone 单文件产物：无磁盘插件树，走编译期内联清单。
  if (isStandaloneExecutable()) return runEmbeddedBootPipeline(ctx, pipeline);
  // loader 对缺失的 include 路径不报错：插件树为空时它照样 await 成功，
  // 调用方随后才以 “Cannot destructure property 'runtime'” 崩掉。先在入口拦。
  assertBootConfigExists(baseDir, configPath);
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
    config: { path: configPath },
  });
  await ctx.loader.await();
  assertBootPhasesMounted(ctx, baseDir, configPath);

  return {
    ...(hmrFiber ? { hmr: hmrFiber } : {}),
    dispose: async () => {
      await hmrFiber?.dispose();
      await loaderFiber.dispose();
    },
  };
}
