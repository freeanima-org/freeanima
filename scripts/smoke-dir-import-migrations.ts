#!/usr/bin/env bun
/**
 * migrations / docs / web dist `dir:` 嵌入契约冒烟（对照磁盘枚举 + Bun.build）。
 *
 * 用法：
 *   bun scripts/smoke-dir-import-migrations.ts
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Glob } from "bun";

import { listEmbeddedMigrationsFromDir } from "@freeanima/host/core/db/migrations-dir-import";
import { listEmbeddedDocsFromDir } from "@freeanima/host/capabilities/tools/docs-dir-import";
import { listEmbeddedWebDistFromDir } from "@freeanima/portal/cli/web/web-dist-dir-import";

import { createDirImportPlugin } from "./dir-import-plugin.ts";

const ROOT = join(import.meta.dir, "..");
const MIGRATIONS_DIR = join(ROOT, "src/host/core/migrations");
const DOCS_DIR = join(ROOT, "docs");
const WEB_DIST_DIR = join(ROOT, "src/portal/app/web/dist");
const WEB_DIST_INDEX = join(WEB_DIST_DIR, "index.html");

function listMigrationDirsFromDisk(): string[] {
  const names = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => existsSync(join(MIGRATIONS_DIR, name, "migration.sql")))
    .toSorted((a, b) => a.localeCompare(b));
  if (names.length === 0) {
    throw new Error(`no migration.sql under ${MIGRATIONS_DIR}`);
  }
  return names;
}

function listDocsRelsFromDisk(): string[] {
  const rels: string[] = [];
  for (const rel of new Glob("**/*.md").scanSync({ cwd: DOCS_DIR, onlyFiles: true })) {
    const normalized = rel.split("\\").join("/");
    if (normalized.startsWith(".generated/") || normalized.includes("/.generated/")) continue;
    rels.push(normalized);
  }
  return rels.toSorted((a, b) => a.localeCompare(b));
}

function assertEqualSets(label: string, actual: string[], expected: string[]): void {
  if (actual.length !== expected.length) {
    throw new Error(
      `${label}: length ${actual.length} !== ${expected.length}\n` +
        `  onlyActual=${actual.filter((x) => !expected.includes(x)).slice(0, 5)}\n` +
        `  onlyExpected=${expected.filter((x) => !actual.includes(x)).slice(0, 5)}`,
    );
  }
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== expected[i]) {
      throw new Error(`${label}: at ${i}: ${actual[i]} !== ${expected[i]}`);
    }
  }
}

async function smokeMigrationsRuntime(): Promise<void> {
  const fromDirApi = listEmbeddedMigrationsFromDir().map((m) => m.name);
  const fromDisk = listMigrationDirsFromDisk();
  assertEqualSets("listEmbeddedMigrationsFromDir vs disk", fromDirApi, fromDisk);

  const migrations = listEmbeddedMigrationsFromDir();
  const sample = migrations[0];
  if (!sample) throw new Error("listEmbeddedMigrationsFromDir returned empty");
  const fromPlugin = await Bun.file(sample.path).text();
  const fromDiskContent = readFileSync(join(MIGRATIONS_DIR, sample.name, "migration.sql"), "utf8");
  if (fromPlugin !== fromDiskContent) {
    throw new Error(`content mismatch for ${sample.name}/migration.sql`);
  }

  console.log(
    `migrations runtime ok: ${fromDirApi.length} migration.sql; sample ${sample.name} (${fromDiskContent.length} bytes)`,
  );
}

async function smokeDocsRuntime(): Promise<void> {
  const fromDirApi = listEmbeddedDocsFromDir().map((d) => d.rel);
  const fromDisk = listDocsRelsFromDisk();
  assertEqualSets("listEmbeddedDocsFromDir vs disk", fromDirApi, fromDisk);

  const docs = listEmbeddedDocsFromDir();
  const sample = docs[0];
  if (!sample) throw new Error("listEmbeddedDocsFromDir returned empty");
  const fromPlugin = await Bun.file(sample.path).text();
  const fromDiskContent = readFileSync(join(DOCS_DIR, sample.rel), "utf8");
  if (fromPlugin !== fromDiskContent) {
    throw new Error(`content mismatch for docs/${sample.rel}`);
  }

  console.log(
    `docs runtime ok: ${fromDirApi.length} .md; sample ${sample.rel} (${fromDiskContent.length} bytes)`,
  );
}

async function smokeWebRuntime(): Promise<void> {
  if (!existsSync(WEB_DIST_INDEX)) {
    console.log("web runtime skip: dist/index.html missing（先 just pack web）");
    return;
  }
  const fromDirApi = listEmbeddedWebDistFromDir().map((f) => f.rel);
  const fromDisk: string[] = [];
  for (const rel of new Glob("**/*").scanSync({ cwd: WEB_DIST_DIR, onlyFiles: true })) {
    const normalized = rel.split("\\").join("/");
    if (normalized === ".ok" || normalized.endsWith("/.ok")) continue;
    fromDisk.push(normalized);
  }
  fromDisk.sort((a, b) => a.localeCompare(b));
  assertEqualSets("listEmbeddedWebDistFromDir vs disk", fromDirApi, fromDisk);

  const files = listEmbeddedWebDistFromDir();
  const sample = files.find((f) => f.rel === "index.html") ?? files[0];
  if (!sample) throw new Error("listEmbeddedWebDistFromDir returned empty");
  const fromPlugin = await Bun.file(sample.path).arrayBuffer();
  const fromDiskBuf = readFileSync(join(WEB_DIST_DIR, sample.rel));
  if (Buffer.from(fromPlugin).compare(fromDiskBuf) !== 0) {
    throw new Error(`content mismatch for web/${sample.rel}`);
  }
  console.log(`web runtime ok: ${fromDirApi.length} files; sample ${sample.rel}`);
}

async function smokeBuild(): Promise<void> {
  const outDir = join(ROOT, "tmp/smoke-dir-import-migrations");
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const entry = join(outDir, "entry.ts");
  await Bun.write(
    entry,
    `import assets from ${JSON.stringify(`dir:${MIGRATIONS_DIR}`)};
const sqlKeys = Object.keys(assets).filter((k) => k.endsWith("/migration.sql"));
if (sqlKeys.length === 0) throw new Error("build entry: no migration.sql keys");
const firstKey = sqlKeys[0];
if (!firstKey) throw new Error("build entry: empty sqlKeys");
const sample = assets[firstKey];
const text = await Bun.file(sample).text();
if (!text.includes(";")) throw new Error("build entry: sample sql looks empty");
console.log("build-run ok:", sqlKeys.length, firstKey);
`,
  );

  const result = await Bun.build({
    entrypoints: [entry],
    outdir: outDir,
    target: "bun",
    plugins: [createDirImportPlugin()],
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    throw new Error("Bun.build failed for dir: migrations");
  }

  const jsOut = result.outputs.find((o) => o.path.endsWith(".js"));
  if (!jsOut) throw new Error("Bun.build produced no .js output");

  const run = Bun.spawnSync({
    cmd: ["bun", jsOut.path],
    cwd: outDir,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (run.exitCode !== 0) {
    throw new Error(
      `built entry failed (${run.exitCode}): ${run.stderr.toString() || run.stdout.toString()}`,
    );
  }

  const sqlOnDisk = readdirSync(outDir).filter((n) => n.endsWith(".sql"));
  if (sqlOnDisk.length === 0) {
    throw new Error("Bun.build produced no .sql assets beside entry");
  }
  console.log(`build ok: ${result.outputs.length} outputs, ${sqlOnDisk.length} .sql on disk`);
  console.log(run.stdout.toString().trim());
  rmSync(outDir, { recursive: true, force: true });
}

await smokeMigrationsRuntime();
await smokeDocsRuntime();
await smokeWebRuntime();
await smokeBuild();
console.log("smoke-dir-import-migrations: all checks passed");
