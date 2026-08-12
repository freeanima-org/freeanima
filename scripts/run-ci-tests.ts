import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { setupIntegrationPg } from "./integration-pg-setup.ts";
import { collectCoverageShards } from "./coverage-collect.ts";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const label = "ci:tests";
const standaloneBin = join(repoRoot, "dist/anima-executable/anima");

function ensureStandaloneBuilt(): void {
  if (existsSync(standaloneBin)) return;
  console.log(`[${label}] building linux standalone for integration tests…`);
  const result = spawnSync("bun", ["scripts/build-cli-executable.ts"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error("build-cli-executable failed before integration tests");
  }
}

function runScript(scriptPath: string): number {
  const result = spawnSync("bun", [scriptPath], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
  return result.status ?? 1;
}

let exitCode = 0;
let teardown: () => Promise<void> = async () => {};

try {
  ensureStandaloneBuilt();
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[${label}] ${msg}`);
  process.exit(1);
}

try {
  teardown = await setupIntegrationPg();
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  // 模板库未就绪时清掉 URL，避免 describePg 误跑并对半成品库 DROP DATABASE 卡住
  delete process.env.ANIMA_TEST_PG_URL;
  console.warn(`[${label}] ${msg}\n[${label}] continuing (PG integration tests will be skipped)`);
}

try {
  const { testFailures } = collectCoverageShards();
  if (testFailures.length > 0) {
    console.error(`[${label}] tests failed for: ${testFailures.join(", ")}`);
    exitCode = 1;
  } else if (runScript("scripts/lcov-to-cobertura.ts") !== 0) {
    exitCode = 1;
  } else if (runScript("scripts/check-coverage-threshold.ts") !== 0) {
    exitCode = 1;
  }
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[${label}] ${msg}`);
  exitCode = 1;
} finally {
  await teardown();
}

process.exit(exitCode);
