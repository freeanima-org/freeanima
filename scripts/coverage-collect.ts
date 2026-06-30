import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { discoverTestRoots, getRepoRoot } from "./test-roots.ts";

const repoRoot = getRepoRoot();
const label = "coverage:cobertura";
const coverageDir = join(repoRoot, "coverage");
const shardDir = join(repoRoot, ".coverage-shards");

export type CoverageCollectResult = {
  shardCount: number;
  testFailures: string[];
};

function runBunTest(extraArgs: string[]): number {
  const result = spawnSync("bun", ["test", ...extraArgs], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
  return result.status ?? 1;
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
      const sfPath = sfMatch[1];
      if (!sfPath) continue;
      records.set(sfPath, `${trimmed}\nend_of_record\n`);
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

function runCoverageTarget(target: string, testFailures: string[]): boolean {
  rmSync(coverageDir, { recursive: true, force: true });
  const status = runBunTest([
    target,
    "--pass-with-no-tests",
    "--coverage",
    "--coverage-reporter=lcov",
  ]);
  if (status !== 0) {
    testFailures.push(target);
  }
  return existsSync(join(coverageDir, "lcov.info"));
}

function saveShard(target: string): string {
  const shardName = target.replaceAll("/", "__") + ".info";
  const shardPath = join(shardDir, shardName);
  writeFileSync(shardPath, readFileSync(join(coverageDir, "lcov.info")));
  return shardPath;
}

/** 按 test root 分片收集 lcov；testFailures 记录 bun test 非零退出的 target */
export function collectCoverageShards(): CoverageCollectResult {
  const testFailures: string[] = [];
  rmSync(coverageDir, { recursive: true, force: true });
  rmSync(shardDir, { recursive: true, force: true });
  mkdirSync(shardDir, { recursive: true });

  const roots = discoverTestRoots();
  const shardFiles: string[] = [];

  for (const root of roots) {
    if (runCoverageTarget(root, testFailures)) {
      shardFiles.push(saveShard(root));
      continue;
    }

    console.warn(`[${label}] ${root} produced no lcov; falling back to per-test-file shards`);
    for (const file of listTestFiles(root)) {
      if (!runCoverageTarget(file, testFailures)) {
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
  return { shardCount: shardFiles.length, testFailures };
}
