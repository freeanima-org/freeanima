import { execSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { setupIntegrationPg } from "./integration-pg-setup.ts";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const label = "test:integration";

let exitCode = 0;
let teardown: () => Promise<void> = async () => {};
const pgPreset = process.env.ANIMA_TEST_PG_URL?.trim();

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
