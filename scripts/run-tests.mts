import { execSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { setupIntegrationPg } from "./integration-pg-setup.ts";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const changed = process.argv.includes("--changed");
const label = changed ? "test:changed" : "test";

function integrationTestsInChangedRun(): boolean {
  try {
    const out = execSync("bun test --changed --dry-run 2>&1", {
      cwd: repoRoot,
      encoding: "utf-8",
    });
    return /tests\/integration\//.test(out);
  } catch {
    return false;
  }
}

const needsPg = !changed || integrationTestsInChangedRun();

let exitCode = 0;
let teardown: () => Promise<void> = async () => {};

if (needsPg) {
  try {
    teardown = await setupIntegrationPg();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[${label}] ${msg}\n[${label}] 继续运行测试（PG 集成用例将 skip）`,
    );
  }
}

const bunArgs = ["test", "--pass-with-no-tests", ...(changed ? ["--changed"] : [])];

try {
  execSync(["bun", ...bunArgs].join(" "), {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
} catch {
  exitCode = 1;
} finally {
  await teardown();
}

process.exit(exitCode);
