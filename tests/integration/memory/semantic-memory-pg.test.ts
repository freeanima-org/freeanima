import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { getTestEngine } from "../../helpers/pg-test.ts";

describePg("semantic_memory PG", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-semantic-");
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  it("CRUD + resident + FTS", async () => {
    const store = getTestEngine().repos.semanticMemory;

    const id = await store.create({
      content: "Freeanima prefers concise direct communication",
      type: "preference",
      pinned: true,
    });
    expect(id).toMatch(/^f-\d{6}-[0-9a-f]{4}$/);

    const loaded = await store.get(id);
    expect(loaded?.content).toContain("Freeanima");
    expect(loaded?.type).toBe("preference");
    expect(loaded?.pinned).toBe(true);

    await store.update({ id, content: "Freeanima prefers concise expression", pinned: false });
    const updated = await store.get(id);
    expect(updated?.content).toBe("Freeanima prefers concise expression");
    expect(updated?.pinned).toBe(false);

    const pinnedId = await store.create({
      content: "pinned probe memory",
      pinned: true,
    });
    const resident = await store.listResident(10);
    expect(resident[0]?.id).toBe(pinnedId);

    const hits = await store.searchFts("Freeanima", { limit: 5 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.id === id)).toBe(true);

    const dup = await store.findByContent("  Freeanima prefers concise expression  ");
    expect(dup?.id).toBe(id);

    expect(await store.count()).toBeGreaterThanOrEqual(2);

    const deleted = await store.delete(pinnedId);
    expect(deleted).toBe(true);
    expect(await store.get(pinnedId)).toBeNull();
  });

  it("FTS proximity: prefers does not false-hit nice/deviated", async () => {
    const store = getTestEngine().repos.semanticMemory;

    const targetId = await store.create({
      content: "Freeanima prefers concise direct communication",
      type: "preference",
    });
    await store.create({ content: "Weather is nice today, feeling good", type: "world" });
    await store.create({ content: "Discussion deviated from the original topic", type: "world" });

    const hits = await store.searchFts("prefers", { limit: 10 });
    const hitIds = hits.map((h) => h.id);
    expect(hitIds).toContain(targetId);
    expect(hits.every((h) => h.content.includes("prefers"))).toBe(true);
  });

  it("search offset and countSearch align", async () => {
    const store = getTestEngine().repos.semanticMemory;
    await store.create({ content: "offset probe one", type: "world" });
    await store.create({ content: "offset probe two", type: "world" });

    const total = await store.countSearch({ query: "offset probe" });
    expect(total).toBeGreaterThanOrEqual(2);

    const page = await store.search({ query: "offset probe", limit: 1, offset: 0 });
    expect(page.length).toBe(1);

    const page2 = await store.search({ query: "offset probe", limit: 1, offset: 1 });
    expect(page2.length).toBe(1);
    expect(page2[0]?.id).not.toBe(page[0]?.id);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
