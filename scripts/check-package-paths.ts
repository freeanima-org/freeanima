#!/usr/bin/env bun
/**
 * `packages/<x>` 路径字面量守卫。
 *
 * 分包重构把目录从 `packages/{habitat,frontend,host,platform}` 迁到了 13 个真包；
 * tsconfig `paths` / Vite 别名会兜住**编译期**的旧路径，但脚本、CLI 与运行时的
 * **文件系统字面量**（`join(root, "packages/...")`、错误提示、glossary 等）
 * 不会被类型系统发现——它们会安静地指向不存在的目录
 * （如 `packages/cli/cli/dev-habitat.ts` 让 `just dev` 直接起不来）。
 *
 * 规则：**代码文件中任何以 `packages/` 开头的路径字面量，其首段必须是
 * `packages/` 下的真实目录**（13 个包 + 允许的少量非包目录）。
 * 生成物目录（`dist`/`target`/`node_modules`/`.output` 等）不参与判断。
 *
 * 用法：`bun scripts/check-package-paths.ts`
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..");

/** 扫描范围（代码文件；文档/规则不在此守卫内） */
const SCAN_DIRS = ["scripts", "packages", "tests", "brand", ".cursor"];
const CODE_EXT = new Set([".ts", ".tsx", ".mjs", ".js"]);
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
]);

/** 允许出现在 `packages/` 下但不是「包」的目录 */
const ALLOWED_TOP_SEGMENTS = new Set(["node_modules"]);

/** 生成物段：命中则跳过该字面量 */
const GENERATED_SEGMENTS = new Set([
  "dist",
  "target",
  "node_modules",
  ".output",
  "coverage",
  "tmp",
]);

/** 行内豁免标记（用于「断言退役前缀不存在」这类用例） */
const ALLOW_MARKER = "check-package-paths:allow";

/** 形如 "packages/<seg>/…" 的路径字面量片段 */
const PACKAGE_LITERAL_RE = /packages\/([A-Za-z0-9._@-]+)((?:\/[A-Za-z0-9._@-]+)*)/g;

const SELF = relative(REPO_ROOT, import.meta.path);

function listCodeFiles(dir: string, out: string[] = []): string[] {
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
      listCodeFiles(abs, out);
      continue;
    }
    const dot = name.lastIndexOf(".");
    if (dot < 0 || !CODE_EXT.has(name.slice(dot))) continue;
    out.push(abs);
  }
  return out;
}

function rel(abs: string): string {
  return relative(REPO_ROOT, abs);
}

function main(): void {
  const files = SCAN_DIRS.flatMap((dir) => listCodeFiles(join(REPO_ROOT, dir)));
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    const fileRel = rel(file);
    if (fileRel === SELF) continue; // 本脚本自身包含规则说明
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(PACKAGE_LITERAL_RE)) {
      const lineStart = text.lastIndexOf("\n", match.index ?? 0) + 1;
      const lineEnd = text.indexOf("\n", match.index ?? 0);
      const line = text.slice(lineStart, lineEnd < 0 ? undefined : lineEnd);
      if (line.includes(ALLOW_MARKER)) continue;
      const top = match[1];
      if (top === undefined) continue;
      const rest = match[2] ?? "";
      const segments = rest.split("/").filter(Boolean);
      if (segments.some((seg) => GENERATED_SEGMENTS.has(seg))) continue;
      if (ALLOWED_TOP_SEGMENTS.has(top)) continue;
      if (existsSync(join(REPO_ROOT, "packages", top))) continue;

      const key = `${fileRel}:${match[0]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      problems.push(`${fileRel}: packages/${top}${rest} —— packages/${top} 不存在`);
    }
  }

  if (problems.length > 0) {
    console.error("check-package-paths: 发现指向不存在目录的 packages/* 字面量");
    for (const problem of problems) console.error(`  ${problem}`);
    console.error(
      `\n提示：分包重构后目录为 ${readdirSync(join(REPO_ROOT, "packages"))
        .filter((name) => !name.startsWith("."))
        .toSorted()
        .join(" / ")}`,
    );
    process.exit(1);
  }

  console.log(
    `check-package-paths: ok（${files.length} 个代码文件；packages/* 字面量均指向真实目录）`,
  );
}

main();
