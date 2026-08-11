import { spawnSync } from "node:child_process";

import { getRepoRoot, listUnitCorePaths } from "./test-tiers.ts";

const repoRoot = getRepoRoot();
const label = "qa test-unit-core";
const paths = listUnitCorePaths();

if (paths.length === 0) {
  console.error(`[${label}] no unit CORE paths resolved`);
  process.exit(1);
}

const args = ["test", ...paths, "--pass-with-no-tests", "--isolate"];
console.log(`[${label}] bun test <${paths.length} core files> --isolate`);

const result = spawnSync("bun", args, {
  cwd: repoRoot,
  stdio: "inherit",
  env: { ...process.env, FREEANIMA_TEST_TIER: "core" },
});

process.exit(result.status ?? 1);
