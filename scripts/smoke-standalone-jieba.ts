#!/usr/bin/env bun
/**
 * standalone 冒烟：jieba 默认词典经 `import … with { type: "file" }` 嵌入，
 * 离开构建机 `@node-rs/jieba` 包目录后二进制仍含词典内容，且不再依赖 dict.js 的
 * `readFileSync(join(__dirname, "dict.txt"))`。
 *
 * 用法（在 just pack cli 之后）：
 *   bun scripts/smoke-standalone-jieba.ts
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = join(import.meta.dir, "..");
const BIN = join(ROOT, "dist/anima-executable/anima");

function resolveJiebaPackageDir(): string {
  const require = createRequire(join(ROOT, "package.json"));
  return dirname(require.resolve("@node-rs/jieba/package.json"));
}

/** 二进制应嵌入 dict.txt 正文，且不应再打进 dict.js 的 __dirname 读盘 loader。 */
export function assertStandaloneBinaryJiebaDictEmbed(
  binaryPath: string,
  jiebaPkgDir: string,
): void {
  const bytes = readFileSync(binaryPath);
  const dictSample = readFileSync(join(jiebaPkgDir, "dict.txt")).subarray(0, 64);
  if (!bytes.includes(dictSample)) {
    throw new Error(
      "standalone binary missing jieba dict.txt content; type:file embed may have failed",
    );
  }
  if (bytes.includes(Buffer.from('join(__dirname, "dict.txt")', "utf8"))) {
    throw new Error(
      "standalone binary still contains @node-rs/jieba/dict.js __dirname loader; avoid importing that module",
    );
  }
}

function run(bin: string, args: string[]): void {
  const r = spawnSync(bin, args, { encoding: "utf-8", cwd: ROOT });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (r.status !== 0) {
    throw new Error(`smoke failed: ${bin} ${args.join(" ")}\n${out}`);
  }
  console.log(`ok: ${bin} ${args.join(" ") || "(no args)"}`);
  if (args.includes("--version") || args.length === 0) {
    console.log(out.trim().split("\n").slice(0, 3).join("\n"));
  }
}

function main(): void {
  if (!existsSync(BIN)) {
    throw new Error(`missing ${BIN}; run just pack cli first`);
  }

  const jiebaDir = resolveJiebaPackageDir();
  assertStandaloneBinaryJiebaDictEmbed(BIN, jiebaDir);

  const hidden = `${jiebaDir}.smoke-hidden`;
  if (existsSync(hidden)) {
    throw new Error(`refusing to overwrite ${hidden}; remove it and retry`);
  }

  console.log(`hiding build-machine jieba dir: ${jiebaDir}`);
  renameSync(jiebaDir, hidden);
  try {
    if (existsSync(jiebaDir)) {
      throw new Error("jieba dir still visible after rename");
    }
    run(BIN, ["--version"]);
    run(BIN, ["--help"]);
  } finally {
    renameSync(hidden, jiebaDir);
    console.log(`restored ${jiebaDir}`);
  }

  console.log("smoke-standalone-jieba: passed");
}

main();
