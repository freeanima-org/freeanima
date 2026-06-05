import type { PgTestContext } from "@freeanima/legacy-db/test-helpers";

import { beginLogIsolation } from "./log-isolation.ts";
import { pgTestUrl } from "./pg-test-gate.ts";

/** 集成测试用例标准开头：临时 home + PG harness */
export async function beginIntegrationCase(prefix: string): Promise<{
  home: string;
  pg: PgTestContext;
}> {
  if (!pgTestUrl) {
    throw new Error("ANIMA_TEST_PG_URL 未设置；请用 bun test");
  }
  const home = beginLogIsolation(prefix);
  const { setupIntegrationHome } = await import("@freeanima/legacy-db/test-helpers");
  const pg = await setupIntegrationHome({ url: pgTestUrl, home });
  return { home, pg };
}

export async function beginIntegrationCaseWithConfig(
  prefix: string,
  configYaml: string,
): Promise<{ home: string; pg: PgTestContext }> {
  if (!pgTestUrl) {
    throw new Error("ANIMA_TEST_PG_URL 未设置；请用 bun test");
  }
  const home = beginLogIsolation(prefix);
  const { setupIntegrationHome } = await import("@freeanima/legacy-db/test-helpers");
  const pg = await setupIntegrationHome({ url: pgTestUrl, home, configYaml });
  return { home, pg };
}

export async function endIntegrationCase(): Promise<void> {
  const { teardownIntegrationHome } = await import("@freeanima/legacy-db/test-helpers");
  await teardownIntegrationHome();
}
