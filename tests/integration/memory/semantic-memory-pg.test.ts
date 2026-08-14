import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import {
  countSemanticMemory,
  countSemanticMemorySearch,
  createSemanticMemory,
  deleteSemanticMemory,
  findSemanticMemoryByContent,
  getSemanticMemory,
  listResidentSemanticMemory,
  listSemanticMemoryBySourceSessions,
  searchSemanticMemory,
  searchSemanticMemoryFts,
  updateSemanticMemory,
} from "@freeanima/habitat/core/db/pg/semantic-memory";

describePg("semantic_memory PG", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-semantic-");
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  it("CRUD + resident + FTS", async () => {
    const id = await createSemanticMemory({
      content: "Freeanima prefers concise direct communication",
      type: "preference",
      pinned: true,
    });
    expect(typeof id).toBe("number");
    expect(id).toBeGreaterThan(0);

    const loaded = await getSemanticMemory(id);
    expect(loaded?.content).toContain("Freeanima");
    expect(loaded?.type).toBe("preference");
    expect(loaded?.pinned).toBe(true);

    await updateSemanticMemory({
      id,
      content: "Freeanima prefers concise expression",
      pinned: false,
    });
    const updated = await getSemanticMemory(id);
    expect(updated?.content).toBe("Freeanima prefers concise expression");
    expect(updated?.pinned).toBe(false);

    const pinnedId = await createSemanticMemory({
      content: "pinned probe memory",
      pinned: true,
    });
    const resident = await listResidentSemanticMemory(10);
    expect(resident[0]?.id).toBe(pinnedId);

    const hits = await searchSemanticMemoryFts("Freeanima", { limit: 5 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.id === id)).toBe(true);

    const dup = await findSemanticMemoryByContent("  Freeanima prefers concise expression  ");
    expect(dup?.id).toBe(id);

    expect(await countSemanticMemory()).toBeGreaterThanOrEqual(2);

    const deleted = await deleteSemanticMemory(pinnedId);
    expect(deleted).toBe(true);
    expect(await getSemanticMemory(pinnedId)).toBeNull();
  });

  it("FTS proximity: prefers does not false-hit nice/deviated", async () => {
    const targetId = await createSemanticMemory({
      content: "Freeanima prefers concise direct communication",
      type: "preference",
    });
    await createSemanticMemory({ content: "Weather is nice today, feeling good", type: "world" });
    await createSemanticMemory({
      content: "Discussion deviated from the original topic",
      type: "world",
    });

    const hits = await searchSemanticMemoryFts("prefers", { limit: 10 });
    const hitIds = hits.map((h) => h.id);
    expect(hitIds).toContain(targetId);
    expect(hits.every((h) => h.content.includes("prefers"))).toBe(true);
  });

  it("search offset and countSearch align", async () => {
    await createSemanticMemory({ content: "offset probe one", type: "world" });
    await createSemanticMemory({ content: "offset probe two", type: "world" });

    const total = await countSemanticMemorySearch({ query: "offset probe" });
    expect(total).toBeGreaterThanOrEqual(2);

    const page = await searchSemanticMemory({ query: "offset probe", limit: 1, offset: 0 });
    expect(page.length).toBe(1);

    const page2 = await searchSemanticMemory({ query: "offset probe", limit: 1, offset: 1 });
    expect(page2.length).toBe(1);
    expect(page2[0]?.id).not.toBe(page[0]?.id);
  });

  it("listSemanticMemoryBySourceSessions matches single and multi ids", async () => {
    const idA = await createSemanticMemory({
      content: "source session probe A",
      type: "world",
      source_conversations: ["20260715_200624_d0d8"],
    });
    const idB = await createSemanticMemory({
      content: "source session probe B",
      type: "world",
      source_conversations: ["sess-b", "sess-c"],
    });
    await createSemanticMemory({
      content: "source session probe unrelated",
      type: "world",
      source_conversations: ["other-sess"],
    });

    const single = await listSemanticMemoryBySourceSessions(["20260715_200624_d0d8"], {
      status: "active",
    });
    expect(single.map((r) => r.id)).toContain(idA);
    expect(single.every((r) => r.source_conversations.includes("20260715_200624_d0d8"))).toBe(true);

    const multi = await listSemanticMemoryBySourceSessions(["sess-b", "sess-c"], {
      status: "active",
    });
    expect(multi.map((r) => r.id)).toContain(idB);
    expect(
      multi.every(
        (r) =>
          r.source_conversations.includes("sess-b") || r.source_conversations.includes("sess-c"),
      ),
    ).toBe(true);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
