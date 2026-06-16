import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { setupIntegrationPg } from "./integration-pg-setup.ts";
import { collectCoverageShards } from "./coverage-collect.ts";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const label = "ci:tests";
const publishedCliJs = join(repoRoot, "cli/publish/dist/cli.js");

function ensurePublishedCliBuilt(): void {
  if (existsSync(publishedCliJs)) return;
  console.log(`[${label}] building cli for integration tests…`);
  const result = spawnSync("bun", ["run", "build:cli"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error("build:cli failed before integration tests");
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
  ensurePublishedCliBuilt();
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[${label}] ${msg}`);
  process.exit(1);
}

try {
  teardown = await setupIntegrationPg();
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
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
