import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import {
  awaitPendingEmbeddingsForTest,
  rebuildAllFtsSegments,
  registerEmbedTextFn,
  resetEmbedTextFnForTest,
  resetPendingEmbeddingsForTest,
} from "@freeanima/host/core/db/pg";
import { hybridSearchSemanticMemory } from "@freeanima/host/core/db/pg/fts/hybrid-search.ts";
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

    // Even with use_vector, vector-only hits are dropped
    const boosted = await hybridSearchSemanticMemory("photosynthesis chlorophyll", {
      limit: 5,
      status: "active",
      use_vector: true,
    });
    expect(boosted.some((h) => h.id === targetId)).toBe(false);
  });

  it("vector can boost a lexical hit without admitting vector-only neighbors", async () => {
    const lexicalId = await createSemanticMemory({
      content: "Owner prefers hamburgers for weekend lunch",
      type: "preference",
    });
    const vectorOnlyId = await createSemanticMemory({
      content: "Quantum chromodynamics lattice gauge theory notes",
      type: "world",
    });

    await awaitPendingEmbeddingsForTest();
    await rebuildAllFtsSegments();

    // Lexical overlap with hamburgers; fixed embedding would also match vectorOnlyId
    // but dropVectorOnlyHits must keep keyword-first.
    const hits = await hybridSearchSemanticMemory("prefers hamburgers", {
      limit: 5,
      status: "active",
      use_vector: true,
    });
    expect(hits.some((h) => h.id === lexicalId)).toBe(true);
    expect(hits.some((h) => h.id === vectorOnlyId)).toBe(false);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
