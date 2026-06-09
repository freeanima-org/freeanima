import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { getTestEngine } from "../../helpers/pg-test.ts";

describePg("recall hybrid PG", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-recall-hybrid-");
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  it("pg_trgm 常开：错别字可召回", async () => {
    const store = getTestEngine().repos.semanticMemory;

    const targetId = await store.create({
      content: "偏好简洁直接的沟通方式",
      type: "preference",
    });

    const hits = await store.searchFts("偏好简结直接", { limit: 5 });
    expect(hits.some((h) => h.id === targetId)).toBe(true);
  });

  it("RRF 合并：FTS 与 trgm 同时命中时排序稳定", async () => {
    const store = getTestEngine().repos.semanticMemory;

    const exactId = await store.create({
      content: "项目代号 Alpha 已上线",
      type: "world",
    });
    await store.create({
      content: "Beta 项目仍在开发",
      type: "world",
    });

    const hits = await store.searchFts("Alpha", { limit: 5 });
    expect(hits[0]?.id).toBe(exactId);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
