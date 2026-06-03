import { execSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { setupIntegrationPg } from "./integration-pg-setup.ts";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");

execSync("bun run build", { cwd: repoRoot, stdio: "inherit" });

const teardown = await setupIntegrationPg();
try {
  execSync("bun test --config tests/bunfig.toml tests/integration", {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
} finally {
  await teardown();
}
