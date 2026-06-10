import { spawn } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { setupIntegrationPg } from "./integration-pg-setup.ts";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const label = "test";

const SUITE_SCRIPTS: Record<string, string> = {
  unit: "scripts/run-unit-tests.ts",
  integration: "scripts/run-integration-tests.ts",
};

function parseSuites(): string[] {
  const idx = process.argv.indexOf("--suites");
  if (idx === -1) {
    return ["unit", "integration"];
  }
  const raw = process.argv[idx + 1];
  if (!raw?.trim()) {
    throw new Error("[test] --suites requires an argument, e.g. unit,integration,e2e");
  }
  const suites = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const suite of suites) {
    if (!SUITE_SCRIPTS[suite]) {
      throw new Error(`[test] unknown suite: ${suite} (available: unit, integration)`);
    }
  }
  return suites;
}

function runScript(scriptPath: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn("bun", [scriptPath], {
      cwd: repoRoot,
      stdio: "inherit",
      env: process.env,
    });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

const suites = parseSuites();
const needsPg = suites.includes("integration");

let exitCode = 0;
let teardown: () => Promise<void> = async () => {};

if (needsPg) {
  try {
    teardown = await setupIntegrationPg();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[${label}] ${msg}\n[${label}] continuing (PG-related tests will be skipped)`);
  }
}

try {
  const codes = await Promise.all(suites.map((suite) => runScript(SUITE_SCRIPTS[suite])));
  if (codes.some((code) => code !== 0)) {
    exitCode = 1;
  }
} catch {
  exitCode = 1;
} finally {
  await teardown();
}

process.exit(exitCode);
