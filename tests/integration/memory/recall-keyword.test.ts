import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import {
  awaitPendingEmbeddingsForTest,
  rebuildAllFtsSegments,
  registerEmbedTextFn,
  resetEmbedTextFnForTest,
  resetPendingEmbeddingsForTest,
} from "@freeanima/host/core/db/pg";
import { SEMANTIC_EMBEDDING_DIMENSIONS } from "@freeanima/host/core/db/schema";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import {
  createSemanticMemory,
  searchSemanticMemoryFts,
} from "@freeanima/host/core/db/pg/semantic-memory";

function fixedEmbedding(value = 0.25): number[] {
  return Array.from({ length: SEMANTIC_EMBEDDING_DIMENSIONS }, () => value);
}

describePg("recall keyword-first PG", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-recall-keyword-");
    registerEmbedTextFn(async () => fixedEmbedding());
  });

  afterEach(async () => {
    resetEmbedTextFnForTest();
    resetPendingEmbeddingsForTest();
    await restoreIntegrationHome(prev);
  });

  it("does not recall on embedding-only similarity without keyword/trgm match", async () => {
    const targetId = await createSemanticMemory({
      content: "Memory consolidation relies on nocturnal processes running in the background",
      type: "world",
    });

    await awaitPendingEmbeddingsForTest();
    await rebuildAllFtsSegments();

    // Same fixed embedding as the stored row, but no lexical overlap with content
    const hits = await searchSemanticMemoryFts("photosynthesis chlorophyll", { limit: 5 });
    expect(hits.some((h) => h.id === targetId)).toBe(false);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
