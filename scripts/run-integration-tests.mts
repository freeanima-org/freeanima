import { execSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function tsc(project: string): void {
  execSync(`pnpm exec tsc -p ${project}`, { cwd: repoRoot, stdio: "inherit" });
}

tsc("packages/db/tsconfig.json");
tsc("packages/runtime/tsconfig.json");
tsc("packages/core/tsconfig.json");
execSync("pnpm exec vitest run --config vitest.integration.mts", {
  cwd: repoRoot,
  stdio: "inherit",
});
