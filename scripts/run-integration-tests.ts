import { execSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { setupIntegrationPg } from "./integration-pg-setup.ts";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const label = "test:integration";
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

let exitCode = 0;
let teardown: () => Promise<void> = async () => {};
const pgPreset = process.env.ANIMA_TEST_PG_URL?.trim();

try {
  ensurePublishedCliBuilt();
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[${label}] ${msg}`);
  process.exit(1);
}

if (!pgPreset) {
  try {
    teardown = await setupIntegrationPg();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[${label}] ${msg}\n[${label}] continuing (PG integration tests will be skipped)`);
  }
}

try {
  execSync("bun test tests/integration --pass-with-no-tests", {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
} catch {
  exitCode = 1;
} finally {
  if (!pgPreset) {
    await teardown();
  }
}

process.exit(exitCode);
