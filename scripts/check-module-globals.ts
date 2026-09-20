#!/usr/bin/env bun
/**
 * 模块级全局桥禁令（棘轮）。
 *
 * Cordis 迁移的收尾目标：不再有 `ensureProcessContext` / `globalThis[Symbol.for]`
 * 这类跨模块服务定位桥，也不再有 `getRootContextOrNull` / `ensureRootContext`
 * 这类进程根句柄逃生口。存量按「pattern × 文件」基线放行，且只减不增；
 * `--update` 收紧基线。收尾完成后基线应为空，规则退化为纯禁令。
 *
 * 生成的基线同时供 oxlint 规则 `freeanima/no-module-globals` 使用
 * （`scripts/oxlint-plugins/freeanima/lib/module-globals-baseline.ts`）。
 *
 * 用法：
 *   bun scripts/check-module-globals.ts            # 校验
 *   bun scripts/check-module-globals.ts --update    # 收紧基线
 *   bun scripts/check-module-globals.ts --print     # 只打印现状
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..");
const BASELINE_TS = join(
  REPO_ROOT,
  "scripts/oxlint-plugins/freeanima/lib/module-globals-baseline.ts",
);
const UPDATE = process.argv.includes("--update");
const PRINT = process.argv.includes("--print");

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
  // 进程根句柄（Cordis 迁移期的临时逃生口）：目标是把这些调用改为显式 ctx/依赖参数。
  ["ensureRootContext", /\bensureRootContext\b/],
  ["getRootContextOrNull", /\bgetRootContextOrNull\b/],
  ["getRootContext", /\bgetRootContext\b(?!OrNull)/],
  ["setRootContext", /\bsetRootContext\b/],
  ["resetRootContextForTest", /\bresetRootContextForTest\b/],
];

type Baseline = Record<string, string[]>;

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

const current: Baseline = {};
for (const [name, pattern] of MODULE_GLOBAL_PATTERNS) {
  for (const file of files) {
    const rel = relative(REPO_ROOT, file).replaceAll("\\", "/");
    const text = readFileSync(file, "utf8");
    const matches = text.match(new RegExp(pattern.source, "g"));
    if (!matches || matches.length === 0) continue;
    (current[name] ??= []).push(rel);
  }
}

function renderBaseline(baseline: Baseline): string {
  const lines = [
    "/**",
    " * 由 `bun scripts/check-module-globals.ts --update` 生成 —— 勿手改。",
    " * 模块级全局桥存量文件清单；只减不增，P3 完成后为空。",
    " */",
    "export const MODULE_GLOBALS_BASELINE: Readonly<Record<string, readonly string[]>> = {",
  ];
  for (const [name, entries] of Object.entries(baseline).toSorted(([a], [b]) =>
    a.localeCompare(b),
  )) {
    // oxfmt 去掉合法标识符键的引号：生成时直接对齐，避免 --update 后 fmt --check 失败。
    const key = /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);
    lines.push(`  ${key}: [`);
    for (const entry of entries.toSorted()) lines.push(`    ${JSON.stringify(entry)},`);
    lines.push("  ],");
  }
  lines.push("};");
  lines.push("");
  return lines.join("\n");
}

function readBaseline(): Baseline {
  try {
    const text = readFileSync(BASELINE_TS, "utf8");
    const out: Baseline = {};
    // oxfmt 会去掉合法标识符键的引号，两种键形式都要认。
    const re = /(?:"([^"]+)"|([A-Za-z_$][\w$]*)):\s*\[([^\]]*)\]/g;
    for (const match of text.matchAll(re)) {
      const name = match[1] ?? match[2];
      if (!name) continue;
      out[name] = [...(match[3] ?? "").matchAll(/"([^"]+)"/g)].flatMap((m) => (m[1] ? [m[1]] : []));
    }
    return out;
  } catch {
    return {};
  }
}

if (PRINT || UPDATE) {
  console.log(JSON.stringify(current, null, 2));
  if (UPDATE) {
    writeFileSync(BASELINE_TS, renderBaseline(current), "utf8");
    const total = Object.values(current).reduce((sum, list) => sum + list.length, 0);
    console.log(`check-module-globals: baseline updated (${total} pattern×file)`);
  }
} else {
  const baseline = readBaseline();
  const problems: string[] = [];
  for (const [name, entries] of Object.entries(current)) {
    const allowed = new Set(baseline[name] ?? []);
    for (const entry of entries) {
      if (!allowed.has(entry)) problems.push(`新增：${name} @ ${entry}`);
    }
  }
  if (problems.length > 0) {
    console.error("check-module-globals: 出现新的模块级全局桥");
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
  const total = Object.values(current).reduce((sum, list) => sum + list.length, 0);
  console.log(`check-module-globals: ok（存量 ${total} pattern×file；P3 目标 0）`);
}
