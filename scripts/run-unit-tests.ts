import { spawnSync } from "node:child_process";

import { discoverUnitTestRoots, getRepoRoot } from "./test-roots.ts";

const repoRoot = getRepoRoot();
const changed = process.argv.includes("--changed");
const label = changed ? "test:changed" : "test:unit";

const roots = discoverUnitTestRoots();
const bunArgs = ["test", ...roots, "--pass-with-no-tests", ...(changed ? ["--changed"] : [])];

const result = spawnSync("bun", bunArgs, {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env,
});

if (result.status !== 0) {
  console.error(`[${label}] bun test exited with code ${result.status ?? "unknown"}`);
  process.exit(1);
}
