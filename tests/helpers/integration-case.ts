import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { PgTestContext } from "@freeanima/legacy-db/test-helpers";

import { pgTestUrl } from "./pg-test-gate.js";

/** 集成测试用例标准开头：临时 home + PG harness */
export async function beginIntegrationCase(prefix: string): Promise<{
  home: string;
  pg: PgTestContext;
}> {
  if (!pgTestUrl) {
    throw new Error("ANIMA_TEST_PG_URL 未设置；请用 pnpm test:integration");
  }
  const home = mkdtempSync(join(tmpdir(), prefix));
  process.env.FREEANIMA_HOME = home;
  const { setupIntegrationHome } = await import("@freeanima/legacy-db/test-helpers");
  const pg = await setupIntegrationHome({ url: pgTestUrl, home });
  return { home, pg };
}

export async function beginIntegrationCaseWithConfig(
  prefix: string,
  configYaml: string,
): Promise<{ home: string; pg: PgTestContext }> {
  if (!pgTestUrl) {
    throw new Error("ANIMA_TEST_PG_URL 未设置；请用 pnpm test:integration");
  }
  const home = mkdtempSync(join(tmpdir(), prefix));
  process.env.FREEANIMA_HOME = home;
  const { setupIntegrationHome } = await import("@freeanima/legacy-db/test-helpers");
  const pg = await setupIntegrationHome({ url: pgTestUrl, home, configYaml });
  return { home, pg };
}

export async function endIntegrationCase(): Promise<void> {
  const { teardownIntegrationHome } = await import("@freeanima/legacy-db/test-helpers");
  await teardownIntegrationHome();
}
