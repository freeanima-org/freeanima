#!/usr/bin/env bun
/**
 * 退役 import 前缀禁令（`just qa check`）。
 *
 * 大重构（13 包拆分）的机械改写已在 P0–P7 执行完毕；本脚本只校验
 * `packages` / `scripts` / `tests` / `types` 下不再出现
 * `scripts/lib/retired-imports.ts` 列出的退役说明符——没有写模式。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { retiredBy, SPECIFIER_RE } from "./lib/retired-imports.ts";

const REPO_ROOT = join(import.meta.dir, "..");
const SCAN_ROOTS = ["packages", "scripts", "tests", "types"];
const SCAN_EXT = /\.(ts|tsx)$/;
/** 退役清单自身与单测故意保留旧前缀，不参与扫描。 */
const EXCLUDE_FILES = new Set([
  "scripts/lib/retired-imports.ts",
  "scripts/lib/retired-imports.test.ts",
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

const problems: string[] = [];
for (const file of collectFiles()) {
  const rel = relative(REPO_ROOT, file).replaceAll("\\", "/");
  if (EXCLUDE_FILES.has(rel)) continue;
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(SPECIFIER_RE)) {
    const spec = match[3];
    if (!spec) continue;
    const retired = retiredBy(spec);
    if (retired) problems.push(`${rel}: ${spec}（命中 ${retired}）`);
  }
}

if (problems.length > 0) {
  console.error(`check-retired-imports: ${problems.length} 处退役说明符`);
  for (const problem of problems.slice(0, 60)) console.error(`  ${problem}`);
  if (problems.length > 60) console.error(`  … 其余 ${problems.length - 60} 处`);
  process.exit(1);
}
console.log("check-retired-imports: ok（无残留退役前缀）");
