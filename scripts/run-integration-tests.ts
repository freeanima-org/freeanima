import { execSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { setupIntegrationPg } from "./integration-pg-setup.ts";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const label = "qa test-integration";
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
    throw new Error("just pack cli / build-cli-executable failed before integration tests");
  }
}

function parallelWorkers(): string {
  const env = process.env.FREEANIMA_TEST_PARALLEL?.trim();
  if (env && /^\d+$/.test(env)) return env;
  try {
    const n = Math.max(
      1,
      Math.min(8, Number(execSync("nproc", { encoding: "utf-8" }).trim()) || 2),
    );
    return String(n);
  } catch {
    return "2";
  }
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
  console.warn(`[${label}] ${msg}\n[${label}] continuing (PG integration tests will be skipped)`);
}

const workers = parallelWorkers();
const paths = process.argv.slice(2);
const testPaths = paths.length > 0 ? paths : ["tests/integration"];
const testArgs = ["test", ...testPaths, "--pass-with-no-tests", `--parallel=${workers}`];
console.log(`[${label}] bun ${testArgs.join(" ")}`);

try {
  const result = spawnSync("bun", testArgs, {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
  exitCode = result.status ?? 1;
} catch {
  exitCode = 1;
} finally {
  await teardown();
}

process.exit(exitCode);
