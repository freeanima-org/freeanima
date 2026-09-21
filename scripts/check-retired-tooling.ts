#!/usr/bin/env bun
/**
 * 退役工具链守卫（`just qa check`）。
 *
 * TypeScript 7 起原生 `tsc` 即 Go 编译器：`@typescript/native-preview`（`tsgo`）
 * 已退役，类型检查统一走 `bun x tsc -p tsconfig.json`。本脚本断言代码 / 配置 /
 * 规则面不再出现该依赖或 `tsgo` 命令，防止回潮。
 *
 * 范围：代码与配置文件（含 `.cursor/*.mdc` 规则、`bun.lock`）；散文文档
 * （`*.md`）不在内，以免迁移说明误报。`tsgolint` / `oxlint-tsgolint` 是另一条
 * 工具链（type-aware lint 后端），不在此禁令内。确需引用旧名的行可加行内豁免
 * 标记 `check-retired-tooling:allow`。
 *
 * 用法：`bun scripts/check-retired-tooling.ts`
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..");

/** 扫描目录（递归） */
const SCAN_DIRS = [
  ".github",
  ".cursor",
  "just",
  "scripts",
  "packages",
  "tests",
  "types",
  "site/src",
];
/** 扫描单文件（相对仓库根） */
const SCAN_FILES = [
  "package.json",
  "Justfile",
  "bunfig.toml",
  "bun.lock",
  ".bun-version",
  "flake.nix",
  "tsconfig.json",
  "tsconfig.base.json",
  "tsconfig.scripts.json",
  "site/package.json",
];
const SCAN_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".jsonc",
  ".yml",
  ".yaml",
  ".just",
  ".nix",
  ".toml",
  ".sh",
  ".mdc",
]);
const SKIP_DIR_NAMES = new Set([
  "node_modules",
  "dist",
  "dist-types",
  "dist-desktop",
  "dist-mobile",
  "dist-float",
  "target",
  "src-tauri",
  "gen",
  ".git",
  ".wxt",
  "coverage",
  "tmp",
  ".astro",
  ".output",
]);

/** 退役依赖名（出现即失败） */
const RETIRED_DEPENDENCY = "@typescript/native-preview";
/** 退役命令（词边界；`tsgolint` / `oxlint-tsgolint` 不命中） */
const RETIRED_COMMAND_RE = /\btsgo\b/;
/** 行内豁免标记（用于「说明退役原因」这类必须引用旧名的行） */
const ALLOW_MARKER = "check-retired-tooling:allow";

const SELF = relative(REPO_ROOT, import.meta.path);

function listFiles(dir: string, out: string[]): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const abs = join(dir, name);
    let isDir = false;
    try {
      isDir = statSync(abs).isDirectory();
    } catch {
      continue;
    }
    if (isDir) {
      if (SKIP_DIR_NAMES.has(name)) continue;
      listFiles(abs, out);
      continue;
    }
    const dot = name.lastIndexOf(".");
    if (dot < 0 || !SCAN_EXT.has(name.slice(dot))) continue;
    out.push(abs);
  }
  return out;
}

function main(): void {
  const files = [
    ...SCAN_DIRS.flatMap((dir) => listFiles(join(REPO_ROOT, dir), [])),
    ...SCAN_FILES.map((file) => join(REPO_ROOT, file)),
  ];
  const problems: string[] = [];

  for (const file of files) {
    const fileRel = relative(REPO_ROOT, file);
    if (fileRel === SELF) continue; // 本脚本自身包含规则说明
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (text.includes(RETIRED_DEPENDENCY) || RETIRED_COMMAND_RE.test(text)) {
      for (const [index, line] of text.split("\n").entries()) {
        if (line.includes(ALLOW_MARKER)) continue;
        if (line.includes(RETIRED_DEPENDENCY)) {
          problems.push(`${fileRel}:${index + 1}: 出现退役依赖 ${RETIRED_DEPENDENCY}`);
        }
        if (RETIRED_COMMAND_RE.test(line)) {
          problems.push(`${fileRel}:${index + 1}: 出现退役命令 tsgo`);
        }
      }
    }
  }

  if (problems.length > 0) {
    console.error(`check-retired-tooling: ${problems.length} 处退役工具链残留`);
    for (const problem of problems.slice(0, 60)) console.error(`  ${problem}`);
    if (problems.length > 60) console.error(`  … 其余 ${problems.length - 60} 处`);
    console.error("提示：TS 7 原生编译器统一用 `bun x tsc -p tsconfig.json`。");
    process.exit(1);
  }
  console.log(
    `check-retired-tooling: ok（${files.length} 个文件；无 tsgo / @typescript/native-preview 残留）`,
  );
}

main();
