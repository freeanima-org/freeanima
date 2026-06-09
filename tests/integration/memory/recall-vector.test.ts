import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import {
  rebuildAllFtsSegments,
  registerEmbedTextFn,
  resetEmbedTextFnForTest,
} from "@freeanima/connectors-db-pg";
import { SEMANTIC_EMBEDDING_DIMENSIONS } from "@freeanima/engine-db/schema";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { getTestEngine } from "../../helpers/pg-test.ts";

function fixedEmbedding(value = 0.25): number[] {
  return Array.from({ length: SEMANTIC_EMBEDDING_DIMENSIONS }, () => value);
}

describePg("recall vector PG", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-recall-vector-");
    registerEmbedTextFn(async () => fixedEmbedding());
  });

  afterEach(async () => {
    resetEmbedTextFnForTest();
    await restoreIntegrationHome(prev);
  });

  it("vector 路：embedding 对齐时可召回（FTS 无字面匹配）", async () => {
    const store = getTestEngine().repos.semanticMemory;

    const targetId = await store.create({
      content: "记忆整理依赖睡眠机制在后台运行",
      type: "world",
    });

    await rebuildAllFtsSegments();

    const hits = await store.searchFts("睡觉机制", { limit: 5 });
    expect(hits.some((h) => h.id === targetId)).toBe(true);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
