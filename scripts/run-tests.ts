import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { setupIntegrationPg } from "./integration-pg-setup.ts";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const changed = process.argv.includes("--changed");
const coverage = process.argv.includes("--coverage");
const label = coverage ? "coverage:cobertura" : changed ? "test:changed" : "test";
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

function integrationTestsInChangedRun(): boolean {
  try {
    const result = spawnSync("bun", ["test", "--changed", "--dry-run"], {
      cwd: repoRoot,
      encoding: "utf-8",
    });
    const out = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    return /tests\/integration\//.test(out);
  } catch {
    return false;
  }
}

function discoverTestRoots(): string[] {
  const roots: string[] = [];
  const layerNames = ["kernel", "engine", "life", "service", "capabilities", "connectors"] as const;

  for (const layer of layerNames) {
    const layerPath = join(repoRoot, layer);
    if (!existsSync(layerPath)) continue;
    for (const entry of readdirSync(layerPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const testsPath = join(layerPath, entry.name, "tests");
      if (existsSync(testsPath)) {
        roots.push(relative(repoRoot, testsPath));
      }
    }
  }

  for (const extra of ["cli/tests", "tests/integration"]) {
    if (existsSync(join(repoRoot, extra))) roots.push(extra);
  }

  return roots.toSorted();
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
    // 测试失败时仍尝试读取 lcov
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

    console.warn(`[${label}] ${root} 未产出 lcov，改为按测试文件分片`);
    for (const file of listTestFiles(root)) {
      if (!runCoverageTarget(file)) {
        console.warn(`[${label}] ${file} 未产出 lcov，跳过`);
        continue;
      }
      shardFiles.push(saveShard(file));
    }
  }

  if (shardFiles.length === 0) {
    throw new Error(`[${label}] 未收集到任何 lcov 分片`);
  }

  mkdirSync(coverageDir, { recursive: true });
  writeFileSync(join(coverageDir, "lcov.info"), mergeLcovFiles(shardFiles));
  console.log(`[${label}] 已合并 ${shardFiles.length} 个 lcov 分片 → coverage/lcov.info`);
}

const needsPg = !changed || integrationTestsInChangedRun();

let exitCode = 0;
let teardown: () => Promise<void> = async () => {};

if (needsPg) {
  try {
    teardown = await setupIntegrationPg();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[${label}] ${msg}\n[${label}] 继续运行测试（PG 集成用例将 skip）`);
  }
}

const bunArgs = [
  "test",
  "--pass-with-no-tests",
  ...(changed ? ["--changed"] : []),
  ...(coverage ? ["--coverage", "--coverage-reporter=lcov"] : []),
  "--path-ignore-patterns",
  "**/tests/e2e/**",
];

try {
  if (coverage) {
    collectCoverageShards();
  } else {
    const result = spawnSync("bun", bunArgs, {
      cwd: repoRoot,
      stdio: "inherit",
      env: process.env,
    });
    if (result.status !== 0) {
      exitCode = 1;
    }
  }
} catch {
  exitCode = 1;
} finally {
  await teardown();
}

process.exit(exitCode);
