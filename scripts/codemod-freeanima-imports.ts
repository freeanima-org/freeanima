#!/usr/bin/env bun
/**
 * 全仓 `@freeanima/*` import 说明符迁移。
 *
 * 大重构（13 包拆分）分阶段落地：每阶段只扩展
 * `scripts/lib/import-rewrites.ts` 的 `REWRITES` / `RETIRED_PREFIXES` 两张表，
 * 再用同一 CLI 做机械改写。
 *
 * 用法：
 *   bun scripts/codemod-freeanima-imports.ts            # 原地改写
 *   bun scripts/codemod-freeanima-imports.ts --dry-run  # 只打印
 *   bun scripts/codemod-freeanima-imports.ts --check    # 校验（just qa check）
 *
 * `--check` 失败（退出码 1）条件：
 *   - 仍存在 `RETIRED_PREFIXES` 前缀的 import 说明符；
 *   - 仍存在会被 `REWRITES` 改写的说明符（表已更新但未执行改写）。
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { rewriteSource } from "./lib/import-rewrites.ts";

const REPO_ROOT = join(import.meta.dir, "..");
const MODE = process.argv.includes("--check")
  ? "check"
  : process.argv.includes("--dry-run")
    ? "dry-run"
    : "write";

const SCAN_ROOTS = ["packages", "scripts", "tests", "types"];
const SCAN_EXT = /\.(ts|tsx)$/;
/** 迁移表自身与单测故意保留旧前缀，不参与扫描。 */
const EXCLUDE_FILES = new Set([
  "scripts/lib/import-rewrites.ts",
  "scripts/lib/import-rewrites.test.ts",
]);
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

function collectFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (SCAN_EXT.test(entry.name)) out.push(full);
    }
  };
  for (const root of SCAN_ROOTS) walk(join(REPO_ROOT, root));
  return out;
}

const pending: string[] = [];
const retired: string[] = [];
let changedFiles = 0;

for (const file of collectFiles()) {
  const rel = relative(REPO_ROOT, file);
  if (EXCLUDE_FILES.has(rel)) continue;
  const before = readFileSync(file, "utf8");
  const outcome = rewriteSource(before);
  for (const entry of outcome.pending) pending.push(`${rel}: ${entry}`);
  for (const entry of outcome.retired) retired.push(`${rel}: ${entry}`);
  if (outcome.next !== before) {
    changedFiles += 1;
    if (MODE === "write") writeFileSync(file, outcome.next);
  }
}

if (MODE === "check") {
  const problems = [...retired, ...pending];
  if (problems.length > 0) {
    console.error(`codemod-freeanima-imports: ${problems.length} 处待处理说明符`);
    for (const problem of problems.slice(0, 60)) console.error(`  ${problem}`);
    if (problems.length > 60) console.error(`  … 其余 ${problems.length - 60} 处`);
    process.exit(1);
  }
  console.log("codemod-freeanima-imports: ok");
} else {
  console.log(
    `codemod-freeanima-imports: ${MODE} — ${pending.length} 处说明符 / ${changedFiles} 个文件`,
  );
  for (const entry of pending.slice(0, 40)) console.log(`  ${entry}`);
  if (pending.length > 40) console.log(`  … 其余 ${pending.length - 40} 处`);
}
