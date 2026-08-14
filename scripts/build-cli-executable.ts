#!/usr/bin/env bun
/**
 * Linux standalone 分发构建（唯一发版产物）：单文件 `anima`。
 *
 * 产物：`dist/anima-executable/anima`
 * - version / service build-meta 经 Bun.build `files` 虚拟覆盖 standalone-meta.ts
 * - migration.sql / docs/*.md / web dist 经调用点 `dir:` + dir-import 插件嵌入
 *
 * 用法：
 *   just pack cli
 *   bun scripts/build-cli-executable.ts
 *   ./dist/anima-executable/anima --version
 */
import { $ } from "bun";
import { cpSync, existsSync, mkdirSync, realpathSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  createComponentBuildMeta,
  resolveBuildChannelFromEnv,
} from "@freeanima/habitat/core/config/build-meta";
import {
  assertStandaloneBinaryHasNoTiktokenBuildPath,
  createTiktokenWasmPlugin,
  resolveTiktokenWasmPath,
} from "./tiktoken-wasm-plugin.ts";
import { createDirImportPlugin } from "./dir-import-plugin.ts";
import { emitPackArtifact } from "./emit-pack-artifact.ts";

const ROOT = join(import.meta.dir, "..");
const OUT_DIR = join(ROOT, "dist/anima-executable");
const CLI_ENTRY = join(ROOT, "packages/habitat/portal/cli/cli.ts");
const META_MODULE = realpathSync(join(ROOT, "packages/habitat/portal/cli/standalone-meta.ts"));
const WEB_DIST_DIR = join(ROOT, "packages/frontend/portal/app/web/dist");
const WEB_DIST_INDEX = join(WEB_DIST_DIR, "index.html");

async function ensureWebDist(): Promise<void> {
  const force = process.env.FREEANIMA_FORCE_WEB_BUILD === "1";
  if (!force && existsSync(WEB_DIST_INDEX)) {
    const { assessMonorepoWebDist } = await import("@freeanima/portal/cli/web/ensure-dist.ts");
    const assessment = assessMonorepoWebDist(ROOT, WEB_DIST_DIR);
    if (!assessment.needsRebuild) {
      console.log("Web dist up to date — skip pack web（FREEANIMA_FORCE_WEB_BUILD=1 可强制）");
      return;
    }
    if (assessment.stale) {
      console.log("Web source newer than dist — rebuilding…");
    } else if (assessment.missing.length > 0) {
      console.log(`Web dist incomplete (${assessment.missing.join(", ")}) — rebuilding…`);
    }
  }

  console.log("building Web dist for embed…");
  await $`bun scripts/build-web.ts`.cwd(ROOT);
  if (!existsSync(WEB_DIST_INDEX)) {
    throw new Error("pack web 完成后仍缺少 packages/frontend/portal/app/web/dist/index.html");
  }
}

function buildStandaloneMetaSource(version: string, buildMeta: unknown): string {
  const metaJson = JSON.stringify({ version, buildMeta });
  return `/** VIRTUAL: injected by scripts/build-cli-executable.ts via Bun.build files */
import type { ComponentBuildMeta } from "@freeanima/habitat/core/config/build-meta.parse";

export type StandaloneRuntimeMetaInject = {
  version: string;
  buildMeta: ComponentBuildMeta;
};

export const standaloneRuntimeMeta: StandaloneRuntimeMetaInject = ${metaJson} as StandaloneRuntimeMetaInject;
`;
}

async function main(): Promise<void> {
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  await ensureWebDist();

  console.log("resolving service build-meta for embed…");
  const channel = resolveBuildChannelFromEnv("local");
  const buildMeta = createComponentBuildMeta({
    component: "service",
    channel,
    repoRoot: ROOT,
    includeBuiltAt: true,
  });
  const embedVersion = buildMeta.version;

  const outfile = join(OUT_DIR, "anima");
  const tiktokenPackageWasm = resolveTiktokenWasmPath(ROOT);
  const tiktokenPackageDir = dirname(tiktokenPackageWasm);
  // staging：避免 type:file 把 node_modules/tiktoken 绝对路径字符串打进二进制
  const stagedWasm = join(OUT_DIR, "tiktoken_bg.wasm");
  cpSync(tiktokenPackageWasm, stagedWasm);
  console.log(
    `compiling single-file standalone → ${outfile} (dir: migrations/docs/web + files meta + tiktoken wasm)`,
  );

  const result = await Bun.build({
    entrypoints: [CLI_ENTRY],
    files: {
      [META_MODULE]: buildStandaloneMetaSource(embedVersion, buildMeta),
    },
    plugins: [createDirImportPlugin(), createTiktokenWasmPlugin(stagedWasm)],
    compile: {
      outfile,
    },
  });

  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }
    throw new Error("Bun.build --compile failed");
  }

  assertStandaloneBinaryHasNoTiktokenBuildPath(outfile, tiktokenPackageDir);
  rmSync(stagedWasm, { force: true });

  console.log(`executable ready: ${outfile}`);
  console.log(`  try: ${outfile} --version`);
  console.log(`  try: ${outfile} service status`);

  const tarballStaging = join(OUT_DIR, ".pack-tarball");
  rmSync(tarballStaging, { recursive: true, force: true });
  mkdirSync(tarballStaging, { recursive: true });
  const stagedAnima = join(tarballStaging, "anima");
  cpSync(outfile, stagedAnima);
  const rawTar = join(OUT_DIR, "anima-linux-x64.staging.tar.gz");
  await $`tar -czf ${rawTar} -C ${tarballStaging} anima`.cwd(ROOT);
  rmSync(tarballStaging, { recursive: true, force: true });
  emitPackArtifact({
    kind: "standalone-linux-tarball",
    sourcePath: rawTar,
    logPrefix: "[pack cli]",
  });
  rmSync(rawTar, { force: true });
}

await main();
