#!/usr/bin/env bun
/**
 * 模块级全局桥禁令（纯禁令，无基线）。
 *
 * Cordis 迁移已收尾：仓库内不再有 `ensureProcessContext` / `globalThis[Symbol.for]`
 * 这类跨模块服务定位桥，也没有 `getRootContextOrNull` / `ensureRootContext`
 * 这类进程根句柄——组合根 context 由 `server/bootstrap` 持有并显式传递，
 * 端口状态归所属模块。任何一处命中即失败。
 *
 * 与 oxlint 规则 `freeanima/no-module-globals` 同源（模式表在此导出）。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..");

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "dist-types",
  "dist-desktop",
  "dist-mobile",
  "dist-float",
  "target",
  ".git",
  ".wxt",
  "src-tauri",
]);

/** 模式 → 中文说明。 */
export const MODULE_GLOBAL_PATTERNS: [string, RegExp][] = [
  ["ensureProcessContext", /\bensureProcessContext\b/],
  ["getProcessContext", /\bgetProcessContext\b/],
  ["resetProcessContextForTests", /\bresetProcessContextForTests\b/],
  ["globalThis-GlobalStore", /globalThis as GlobalStore/],
  [
    "Symbol.for-process-context",
    /Symbol\.for\("@freeanima\/(?:process-context|runtime-context)"\)/,
  ],
  ["Symbol.for-appRuntime", /Symbol\.for\("freeanima\.appRuntime"\)/],
  // 进程根句柄（Cordis 迁移期逃生口，已消除；禁止复活）。
  ["ensureRootContext", /\bensureRootContext\b/],
  ["getRootContextOrNull", /\bgetRootContextOrNull\b/],
  ["getRootContext", /\bgetRootContext\b(?!OrNull)/],
  ["setRootContext", /\bsetRootContext\b/],
  ["resetRootContextForTest", /\bresetRootContextForTest\b/],
];

function collectFiles(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
}

const files: string[] = [];
collectFiles(join(REPO_ROOT, "packages"), files);

const problems: string[] = [];
for (const [name, pattern] of MODULE_GLOBAL_PATTERNS) {
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    if (!pattern.test(text)) continue;
    problems.push(`${name} @ ${relative(REPO_ROOT, file).replaceAll("\\", "/")}`);
  }
}

if (problems.length > 0) {
  console.error("check-module-globals: 出现模块级全局桥/进程根句柄");
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log(`check-module-globals: ok（${MODULE_GLOBAL_PATTERNS.length} 类模式，0 命中）`);
