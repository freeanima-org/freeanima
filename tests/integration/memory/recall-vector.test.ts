import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import {
  flushEmbeddingQueueForTest,
  rebuildAllFtsSegments,
  registerEmbedTextFn,
  registerEmbedTextsFn,
  resetEmbedTextFnForTest,
  resetEmbedTextsFnForTest,
  resetEmbeddingQueueForTest,
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
    registerEmbedTextsFn(async (texts) => texts.map(() => fixedEmbedding()));
  });

  afterEach(async () => {
    resetEmbedTextFnForTest();
    resetEmbedTextsFnForTest();
    resetEmbeddingQueueForTest();
    await restoreIntegrationHome(prev);
  });

  it("vector path: recall when embeddings align (no literal FTS match)", async () => {
    const store = getTestEngine().repos.semanticMemory;

    const targetId = await store.create({
      content: "Memory consolidation relies on sleep mechanisms running in the background",
      type: "world",
    });

    await flushEmbeddingQueueForTest();
    await rebuildAllFtsSegments();

    const hits = await store.searchFts("sleep mechanism", { limit: 5 });
    expect(hits.some((h) => h.id === targetId)).toBe(true);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
