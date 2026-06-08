import { execSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { setupIntegrationPg } from "./integration-pg-setup.ts";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");

let exitCode = 0;
let teardown: () => Promise<void> = async () => {};

try {
  teardown = await setupIntegrationPg();
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.warn(`[test:e2e] ${msg}\n[test:e2e] 继续运行（PG 相关用例可能 skip）`);
}

try {
  execSync("bun test tests/e2e --pass-with-no-tests", {
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
