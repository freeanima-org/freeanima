#!/usr/bin/env bun
/**
 * 外部依赖声明守卫：**包内 import 的第三方包必须写在该包 `package.json`**。
 *
 * 背景：P4/P5 拆包时按「实际 import 扫描」生成各包 package.json，但漏掉了
 * 若干外部依赖（`@noble/hashes`、`acme-client`、`imapflow`、`@tauri-apps/api` 等）。
 * 漏声明不会立刻报错——旧 `node_modules` 里还留着 hoisted 副本；一旦按 lockfile
 * 干净安装或换机器，就会直接模块找不到（本次 `just dev` 事故的同类根因）。
 * 后续代码搬迁（如 email 连接器 capabilities → features）也必须连外部依赖一起搬。
 *
 * 规则：对每个 `packages/<pkg>`，扫描其 `*.ts/tsx/mjs/js` 的裸 import：
 * - 跳过相对路径、`@freeanima/*`（由 check-package-deps 管）、`node:*`/`bun:*`、Node 内建、`@types/*`、虚拟模块（`virtual:*`）与 `dir:` 字面量；
 * - 其余包名必须出现在该包 `dependencies`/`devDependencies`/`peerDependencies`。
 *
 * 用法：`bun scripts/check-external-deps.ts`
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { assertNarrow } from "@freeanima/shared/assert-narrow.ts";
import { isRecord } from "@freeanima/shared/util";

const REPO_ROOT = join(import.meta.dir, "..");
const PACKAGES_DIR = join(REPO_ROOT, "packages");

/** Node 内建模块（含 `node:` 前缀写法在 import 处已被剥离） */
const NODE_BUILTINS = new Set([
  "assert",
  "async_hooks",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "constants",
  "crypto",
  "dgram",
  "diagnostics_channel",
  "dns",
  "domain",
  "events",
  "fs",
  "http",
  "http2",
  "https",
  "inspector",
  "module",
  "net",
  "os",
  "path",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "stream",
  "string_decoder",
  "test",
  "timers",
  "tls",
  "trace_events",
  "tty",
  "url",
  "util",
  "v8",
  "vm",
  "wasi",
  "worker_threads",
  "zlib",
  "sqlite",
]);

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "dist-types",
  "dist-desktop",
  "dist-mobile",
  "dist-float",
  "target",
  "gen",
  ".wxt",
  "src-tauri",
  "coverage",
]);

const CODE_EXT = new Set([".ts", ".tsx", ".mjs", ".js"]);
const CSS_EXT = new Set([".css"]);
const IMPORT_RE = /(?:from\s+|import\s*\(\s*|require\(\s*)["']([^"']+)["']/g;
/** CSS：Tailwind \`@plugin\` 与裸 \`@import\`（非相对、非 URL） */
const CSS_DEP_RE = /@(?:plugin|import|source)\s+["']([^"']+)["']/g;

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

function listCodeFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const abs = join(dir, name);
    let isDir = false;
    try {
      isDir = statSync(abs).isDirectory();
    } catch {
      continue;
    }
    if (isDir) {
      listCodeFiles(abs, out);
      continue;
    }
    const dot = name.lastIndexOf(".");
    if (dot < 0 || !(CODE_EXT.has(name.slice(dot)) || CSS_EXT.has(name.slice(dot)))) continue;
    out.push(abs);
  }
  return out;
}

function packageNameOf(specifier: string): string {
  if (!specifier.startsWith("@")) return specifier.split("/")[0] ?? specifier;
  return specifier.split("/").slice(0, 2).join("/");
}

function isThirdParty(specifier: string): boolean {
  if (specifier.startsWith(".") || specifier.startsWith("/")) return false;
  if (specifier.startsWith("@freeanima/")) return false;
  if (specifier.startsWith("node:") || specifier.startsWith("bun:") || specifier === "bun") {
    return false;
  }
  if (specifier.startsWith("@types/")) return false;
  // Vite/WXT 等虚拟模块与 bun 插件 dir: 语法
  if (specifier.startsWith("virtual:")) return false;
  if (specifier.startsWith("dir:")) return false;
  return !NODE_BUILTINS.has(packageNameOf(specifier));
}

function main(): void {
  const packages = readdirSync(PACKAGES_DIR).filter((name) => !name.startsWith("."));
  const failures: string[] = [];

  for (const pkg of packages) {
    const dir = join(PACKAGES_DIR, pkg);
    let raw: string;
    try {
      raw = readFileSync(join(dir, "package.json"), "utf8");
    } catch {
      continue;
    }
    const parsed: unknown = JSON.parse(raw);
    const pj = assertNarrow<PackageJson>(isRecord(parsed) ? parsed : {});
    const declared = new Set([
      ...Object.keys(pj.dependencies ?? {}),
      ...Object.keys(pj.devDependencies ?? {}),
      ...Object.keys(pj.peerDependencies ?? {}),
    ]);
    const missing = new Map<string, string>();

    for (const file of listCodeFiles(dir)) {
      const text = readFileSync(file, "utf8");
      const pattern = CSS_EXT.has(file.slice(file.lastIndexOf("."))) ? CSS_DEP_RE : IMPORT_RE;
      for (const match of text.matchAll(pattern)) {
        const specifier = match[1];
        if (specifier === undefined || !isThirdParty(specifier)) continue;
        const name = packageNameOf(specifier);
        if (declared.has(name) || missing.has(name)) continue;
        missing.set(name, relative(REPO_ROOT, file));
      }
    }

    if (missing.size > 0) {
      for (const [name, file] of [...missing].toSorted(([a], [b]) => a.localeCompare(b))) {
        failures.push(`@freeanima/${pkg}: 未声明 "${name}"（${file}）`);
      }
    }
  }

  if (failures.length > 0) {
    console.error("check-external-deps: 有第三方 import 未在该包 package.json 声明");
    for (const failure of failures) console.error(`  ${failure}`);
    console.error("\n修复：把依赖写进对应包的 dependencies（版本与仓库其他包保持一致）。");
    process.exit(1);
  }

  console.log(`check-external-deps: ok（${packages.length} 个包的第三方 import 均已声明）`);
}

main();
