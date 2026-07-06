/** 桌面壳 main.cjs 打包不变量（CI / 本地 release 前断言） */

const NODE_BUILTINS = new Set([
  "assert",
  "buffer",
  "child_process",
  "cluster",
  "constants",
  "crypto",
  "dgram",
  "dns",
  "events",
  "fs",
  "http",
  "http2",
  "https",
  "module",
  "net",
  "os",
  "path",
  "perf_hooks",
  "process",
  "querystring",
  "readline",
  "stream",
  "string_decoder",
  "timers",
  "tls",
  "tty",
  "url",
  "util",
  "v8",
  "vm",
  "worker_threads",
  "zlib",
]);

/** 安装包冷启动路径上必须打进 bundle 的包（出现 require("…") 即失败） */
const MUST_INLINE_PACKAGES = ["electron-store", "commander", "zod"] as const;

/** 可选 native / 死分支 require；安装包无 node_modules 时允许失败 */
const OPTIONAL_EXTERNAL_PACKAGES = new Set([
  "bufferutil",
  "utf-8-validate",
  "fsevents",
  "pnpapi",
  "ws",
  "postcss",
  "sugarss",
  "picomatch",
]);

/** 扫描 main.cjs，防止安装包启动类回归 */
export function assertElectronMainBundle(mainCode: string): void {
  for (const pkg of MUST_INLINE_PACKAGES) {
    const pattern = new RegExp(
      `require\\(["']${pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']\\)`,
    );
    if (pattern.test(mainCode)) {
      throw new Error(
        `${pkg} 不得 external：安装包无 node_modules，且 ESM 包在 CJS require 下易触发 default is not a constructor`,
      );
    }
  }

  if (!/ElectronStore|freeanima-shell/.test(mainCode)) {
    throw new Error("main bundle 未包含 electron-store / shell 配置逻辑，请检查 esbuild 入口");
  }

  const requirePattern = /require\(["']([^"']+)["']\)/g;
  for (const match of mainCode.matchAll(requirePattern)) {
    const spec = match[1];
    if (!spec) continue;
    if (spec === "electron") continue;
    if (OPTIONAL_EXTERNAL_PACKAGES.has(spec)) continue;
    if (spec.startsWith("ajv") || spec.startsWith("ajv-")) continue;
    if (spec.startsWith("node:")) {
      const root = spec.slice("node:".length).split("/")[0] ?? "";
      if (!NODE_BUILTINS.has(root)) {
        throw new Error(`main bundle 含未知 node: 内建引用：${spec}`);
      }
      continue;
    }
    if (NODE_BUILTINS.has(spec)) continue;
    if (spec.startsWith(".") || spec.startsWith("/")) continue;
    if (spec.includes("lightningcss") && spec.endsWith(".node")) continue;

    throw new Error(
      `main bundle 含可疑 external require("${spec}")；若为主进程必需依赖，请加入 BUNDLED_NPM_PACKAGES（见 .agent/rules/electron-desktop.md）`,
    );
  }
}
