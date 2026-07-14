#!/usr/bin/env bun
/**
 * Linux standalone 分发构建（唯一发版产物）。
 *
 * 产物：`dist/anima-executable/`
 * - `anima` — standalone 二进制（migration.sql + Web dist 经 `type: "file"` 嵌入）
 * - `package.json` — 供 getRepoRoot 识别安装前缀（name 可为 @freeanima/cli，非 npm 包）
 * - `dist/build-meta.json` — service build-meta
 *
 * 用法：
 *   bun run build:cli:executable
 *   ./dist/anima-executable/anima --version
 */
import { $ } from "bun";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const OUT_DIR = join(ROOT, "dist/anima-executable");
const COMPILE_ENTRY = join(OUT_DIR, ".compile-entry.ts");
const WEB_DIST_INDEX = join(ROOT, "src/app/shell/web/dist/index.html");
const ROOT_PKG = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")) as {
  version: string;
};

async function ensureWebDist(): Promise<void> {
  if (existsSync(WEB_DIST_INDEX)) {
    console.log("Web dist present — will embed");
    return;
  }
  console.log("Web dist missing — running build:web…");
  await $`bun run build:web`;
  if (!existsSync(WEB_DIST_INDEX)) {
    throw new Error("build:web 完成后仍缺少 src/app/shell/web/dist/index.html");
  }
}

async function main(): Promise<void> {
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(join(OUT_DIR, "dist"), { recursive: true });

  await ensureWebDist();

  console.log("generating service build-meta…");
  await $`bun ${join(ROOT, "scripts/gen-build-meta.ts")} --component service --channel prod --out ${join(OUT_DIR, "dist/build-meta.json")} --repo-root ${ROOT}`;

  writeFileSync(
    join(OUT_DIR, "package.json"),
    `${JSON.stringify(
      {
        name: "@freeanima/cli",
        version: ROOT_PKG.version,
        description: "FreeAnima CLI standalone executable layout (experimental)",
        type: "module",
        private: true,
      },
      null,
      2,
    )}\n`,
  );

  console.log("generating compile entry (migrations + web dist)…");
  await $`bun ${join(ROOT, "scripts/gen-standalone-compile-entry.ts")} --out ${COMPILE_ENTRY}`;

  const outfile = join(OUT_DIR, "anima");
  console.log(`compiling standalone executable → ${outfile}`);
  await $`bun build ${COMPILE_ENTRY} --compile --outfile ${outfile}`;

  rmSync(COMPILE_ENTRY, { force: true });

  console.log(`executable ready: ${OUT_DIR}`);
  console.log(`  try: ${outfile} --version`);
  console.log(`  try: ${outfile} service status`);
}

await main();
