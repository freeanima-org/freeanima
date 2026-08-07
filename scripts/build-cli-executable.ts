#!/usr/bin/env bun
/**
 * Linux standalone 分发构建（唯一发版产物）：单文件 `anima`。
 *
 * 产物：`dist/anima-executable/anima`
 * - version / service build-meta / migration.sql / Web dist 均嵌入二进制
 *
 * 用法：
 *   just pack cli
 *   bun scripts/build-cli-executable.ts
 *   ./dist/anima-executable/anima --version
 */
import { $ } from "bun";
import { Glob } from "bun";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  createComponentBuildMeta,
  resolveBuildChannelFromEnv,
} from "@freeanima/host/core/config/build-meta";
import {
  createStandaloneEmbedPlugin,
  type StandaloneEmbedInput,
} from "./standalone-embed-plugin.ts";
import { listDocsEmbeds } from "./standalone-docs-embeds.ts";
import {
  assertStandaloneBinaryHasNoTiktokenBuildPath,
  createTiktokenWasmPlugin,
  resolveTiktokenWasmPath,
} from "./tiktoken-wasm-plugin.ts";
import { emitPackArtifact } from "./emit-pack-artifact.ts";

const ROOT = join(import.meta.dir, "..");
const OUT_DIR = join(ROOT, "dist/anima-executable");
const CLI_ENTRY = join(ROOT, "src/portal/cli/cli.ts");
const EMBEDS_MODULE = join(ROOT, "src/portal/cli/standalone-embeds.ts");
const MIGRATIONS_DIR = join(ROOT, "src/host/core/migrations");
const WEB_DIST_DIR = join(ROOT, "src/portal/app/web/dist");
const WEB_DIST_INDEX = join(WEB_DIST_DIR, "index.html");
const DOCS_DIR = join(ROOT, "docs");

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
    throw new Error("pack web 完成后仍缺少 src/portal/app/web/dist/index.html");
  }
}

function listMigrationEmbeds(): StandaloneEmbedInput[] {
  const names = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => existsSync(join(MIGRATIONS_DIR, name, "migration.sql")))
    .toSorted((a, b) => a.localeCompare(b));
  if (names.length === 0) {
    throw new Error(`no migration.sql under ${MIGRATIONS_DIR}`);
  }
  return names.map((name) => ({
    kind: "migration" as const,
    rel: name,
    absPath: join(MIGRATIONS_DIR, name, "migration.sql"),
  }));
}

function listWebEmbeds(): StandaloneEmbedInput[] {
  if (!existsSync(WEB_DIST_INDEX)) {
    throw new Error(`Web dist 缺失（${WEB_DIST_DIR}）。请先 just pack web`);
  }
  const files: StandaloneEmbedInput[] = [];
  for (const rel of new Glob("**/*").scanSync({ cwd: WEB_DIST_DIR, onlyFiles: true })) {
    const normalized = rel.split("\\").join("/");
    if (normalized === ".ok" || normalized.endsWith("/.ok")) continue;
    files.push({
      kind: "web",
      rel: normalized,
      absPath: join(WEB_DIST_DIR, normalized),
    });
  }
  if (files.length === 0) {
    throw new Error(`Web dist 为空: ${WEB_DIST_DIR}`);
  }
  return files.toSorted((a, b) => a.rel.localeCompare(b.rel));
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

  const files = [...listMigrationEmbeds(), ...listWebEmbeds(), ...listDocsEmbeds(DOCS_DIR)];
  const outfile = join(OUT_DIR, "anima");
  const tiktokenPackageWasm = resolveTiktokenWasmPath(ROOT);
  const tiktokenPackageDir = dirname(tiktokenPackageWasm);
  // staging：避免 type:file 把 node_modules/tiktoken 绝对路径字符串打进二进制
  const stagedWasm = join(OUT_DIR, "tiktoken_bg.wasm");
  cpSync(tiktokenPackageWasm, stagedWasm);
  console.log(
    `compiling single-file standalone → ${outfile} (${files.length} embedded files + runtime meta + tiktoken wasm)`,
  );

  const result = await Bun.build({
    entrypoints: [CLI_ENTRY],
    plugins: [
      createStandaloneEmbedPlugin({
        embedsModulePath: EMBEDS_MODULE,
        files,
        version: embedVersion,
        buildMeta,
      }),
      createTiktokenWasmPlugin(stagedWasm),
    ],
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
