import { setupIntegrationPg } from "./integration-pg-setup.ts";
import { collectCoverageShards } from "./coverage-collect.ts";

const label = "coverage:cobertura";

if (!process.argv.includes("--coverage")) {
  console.error("[run-tests] only supports --coverage (invoked by coverage:cobertura)");
  process.exit(1);
}

let exitCode = 0;
let teardown: () => Promise<void> = async () => {};

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
  }
} catch {
  exitCode = 1;
} finally {
  await teardown();
}

process.exit(exitCode);
