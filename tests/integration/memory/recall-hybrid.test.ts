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

  it("pg_trgm always on: typo-tolerant recall", async () => {
    const store = getTestEngine().repos.semanticMemory;

    const targetId = await store.create({
      content: "Prefers concise direct communication",
      type: "preference",
    });

    const hits = await store.searchFts("Prefers concse direct", { limit: 5 });
    expect(hits.some((h) => h.id === targetId)).toBe(true);
  });

  it("RRF merge: stable ranking when FTS and trgm both hit", async () => {
    const store = getTestEngine().repos.semanticMemory;

    const exactId = await store.create({
      content: "Project codename Alpha is live",
      type: "world",
    });
    await store.create({
      content: "Beta project still in development",
      type: "world",
    });

    const hits = await store.searchFts("Alpha", { limit: 5 });
    expect(hits[0]?.id).toBe(exactId);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
