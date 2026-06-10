import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { setupIntegrationPg } from "./integration-pg-setup.ts";
import { discoverTestRoots, getRepoRoot } from "./test-roots.ts";

const repoRoot = getRepoRoot();
const label = "coverage:cobertura";
const coverageDir = join(repoRoot, "coverage");
const shardDir = join(repoRoot, ".coverage-shards");

function runBunTest(extraArgs: string[]): void {
  const result = spawnSync("bun", ["test", ...extraArgs], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`bun test exited with code ${result.status ?? "unknown"}`);
  }
}

function mergeLcovFiles(files: string[]): string {
  const records = new Map<string, string>();

  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    for (const block of content.split("end_of_record")) {
      const trimmed = block.trim();
      if (!trimmed) continue;
      const sfMatch = /^SF:(.+)$/m.exec(trimmed);
      if (!sfMatch) continue;
      records.set(sfMatch[1], `${trimmed}\nend_of_record\n`);
    }
  }

  return [...records.values()].join("");
}

function listTestFiles(root: string): string[] {
  const absRoot = join(repoRoot, root);
  const files: string[] = [];

  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(".test.ts") || entry.name.endsWith(".spec.ts"))
      ) {
        files.push(relative(repoRoot, full));
      }
    }
  }

  walk(absRoot);
  return files;
}

function runCoverageTarget(target: string): boolean {
  rmSync(coverageDir, { recursive: true, force: true });
  try {
    runBunTest([target, "--pass-with-no-tests", "--coverage", "--coverage-reporter=lcov"]);
  } catch {
    // On test failure, still try to read lcov
  }
  return existsSync(join(coverageDir, "lcov.info"));
}

function saveShard(target: string): string {
  const shardName = target.replaceAll("/", "__") + ".info";
  const shardPath = join(shardDir, shardName);
  writeFileSync(shardPath, readFileSync(join(coverageDir, "lcov.info")));
  return shardPath;
}

function collectCoverageShards(): void {
  rmSync(coverageDir, { recursive: true, force: true });
  rmSync(shardDir, { recursive: true, force: true });
  mkdirSync(shardDir, { recursive: true });

  const roots = discoverTestRoots();
  const shardFiles: string[] = [];

  for (const root of roots) {
    if (runCoverageTarget(root)) {
      shardFiles.push(saveShard(root));
      continue;
    }

    console.warn(`[${label}] ${root} produced no lcov; falling back to per-test-file shards`);
    for (const file of listTestFiles(root)) {
      if (!runCoverageTarget(file)) {
        console.warn(`[${label}] ${file} produced no lcov; skipping`);
        continue;
      }
      shardFiles.push(saveShard(file));
    }
  }

  if (shardFiles.length === 0) {
    throw new Error(`[${label}] collected no lcov shards`);
  }

  mkdirSync(coverageDir, { recursive: true });
  writeFileSync(join(coverageDir, "lcov.info"), mergeLcovFiles(shardFiles));
  console.log(`[${label}] merged ${shardFiles.length} lcov shards → coverage/lcov.info`);
}

if (!process.argv.includes("--coverage")) {
  console.error("[run-tests] only supports --coverage (invoked by coverage:cobertura)");
  process.exit(1);
}

let exitCode = 0;
let teardown: () => Promise<void> = async () => {};

try {
  teardown = await setupIntegrationPg();
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.warn(`[${label}] ${msg}\n[${label}] continuing (PG integration tests will be skipped)`);
}

try {
  collectCoverageShards();
} catch {
  exitCode = 1;
} finally {
  await teardown();
}

process.exit(exitCode);
