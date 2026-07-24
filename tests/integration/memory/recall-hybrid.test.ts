import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
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

describePg("recall hybrid PG", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-recall-hybrid-");
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  it("pg_trgm always on: typo-tolerant recall", async () => {
    const targetId = await createSemanticMemory({
      content: "Prefers concise direct communication",
      type: "preference",
    });

    const hits = await searchSemanticMemoryFts("Prefers concse direct", { limit: 5 });
    expect(hits.some((h) => h.id === targetId)).toBe(true);
  });

  it("RRF merge: stable ranking when FTS and trgm both hit", async () => {
    const exactId = await createSemanticMemory({
      content: "Project codename Alpha is live",
      type: "world",
    });
    await createSemanticMemory({
      content: "Beta project still in development",
      type: "world",
    });

    const hits = await searchSemanticMemoryFts("Alpha", { limit: 5 });
    expect(hits[0]?.id).toBe(exactId);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
