import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAppRuntime } from "@freeanima/platform";
import { SELF_BLOCK_KEYS } from "@freeanima/core/repos";
import { getTestEngine, getActivePgTestContext, seedSession } from "../../helpers/pg-test.ts";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/sap-chat-test-platform.ts";

describePg("server memory API", () => {
  let home: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    const ctx = await beginIntegrationCase("freeanima-memapi-");
    home = ctx.home;
    writeFileSync(join(home, "MEMORY.md"), "# Memory notes\n", "utf-8");
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  it("listMemoryFiles returns objects with name and content", async () => {
    await getTestEngine().repos.semanticMemory.create({
      id: "f-000001-abcd",
      content: "test semantic memory",
    });
    const { files } = await getAppRuntime().listMemoryFiles();
    expect(files.length).toBeGreaterThan(0);
    const memory = files.find((f: { name: string }) => f.name === "MEMORY.md");
    expect(memory).toBeDefined();
    expect(memory!.content).toContain("Memory notes");
    expect(typeof memory!.size).toBe("number");
    expect(files.some((f: { name: string }) => f.name.startsWith("f-"))).toBe(true);
  });

  it("memorySearch returns structured semantic memory and PG dialogue hits", async () => {
    await getTestEngine().repos.semanticMemory.create({
      content: "Freeanima memory pipeline uses compression",
      type: "world",
    });

    const sid = "20260526_120000_abcd";
    await seedSession(
      getTestEngine(),
      sid,
      {
        role: "session_meta",
        model: "test-model",
        cached_toolsets: [],
        functions: [],
        timestamp: "2026-05-26T12:00:00+08:00",
        platform: TEST_SAP_CHAT_PLATFORM,
        title: "t",
      },
      [
        {
          role: "user",
          timestamp: "2026-05-26T12:00:00+08:00",
          content: "Discuss compression algorithm",
          pos: 1,
        },
      ],
    );

    const out = await getAppRuntime().memorySearch({ query: "compression" });
    expect(out.results.length).toBeGreaterThan(0);
    const semantic = out.results.find((r: { memory_type: string }) => r.memory_type === "semantic");
    const session = out.results.find((r: { memory_type: string }) => r.memory_type === "session");
    expect(semantic).toBeDefined();
    expect(session).toBeDefined();
    expect(semantic!.score).toBeGreaterThan(0);
    if (session?.memory_type === "session") {
      expect(session.session_id).toBe(sid);
      expect(session.snippet.length).toBeGreaterThan(0);
    }
  });

  it("countSemanticMemory returns semantic memory count", async () => {
    await getTestEngine().repos.semanticMemory.create({
      content: "semantic memory count probe gamma",
      type: "world",
    });

    const { index_rows } = await getAppRuntime().countSemanticMemory();
    expect(index_rows).toBeGreaterThan(0);
    const hits = await getAppRuntime().memorySearch({ query: "gamma" });
    expect(hits.results.some((r: { memory_type: string }) => r.memory_type === "semantic")).toBe(
      true,
    );
  });

  it("listSemanticMemories supports filter offset and total", async () => {
    await getTestEngine().repos.semanticMemory.create({
      content: "list probe alpha unique-token",
      type: "preference",
    });
    await getTestEngine().repos.semanticMemory.create({
      content: "list probe beta unique-token",
      type: "world",
    });

    const filtered = await getAppRuntime().listSemanticMemories({
      query: "unique-token",
      types: ["preference"],
      limit: 10,
      sort_by: "rank",
    });
    expect(filtered.total).toBe(1);
    expect(filtered.items.length).toBe(1);
    expect(filtered.items[0]?.type).toBe("preference");

    const page = await getAppRuntime().listSemanticMemories({
      limit: 1,
      offset: 0,
    });
    expect(page.total).toBeGreaterThanOrEqual(2);
    expect(page.items.length).toBe(1);
    expect(page.offset).toBe(0);
    expect(page.limit).toBe(1);
  });

  it("listSemanticMemories supports sort_by and reference_count", async () => {
    const { semanticMemory } = getTestEngine().repos;
    const lowId = await semanticMemory.create({
      content: "sort probe low refs unique-sort-token",
      type: "world",
    });
    const highId = await semanticMemory.create({
      content: "sort probe high refs unique-sort-token",
      type: "world",
    });

    const ctx = getActivePgTestContext();
    if (!ctx) throw new Error("PG test context missing");
    await ctx.sql`UPDATE semantic_memory SET reference_count = ${1} WHERE id = ${lowId}`;
    await ctx.sql`UPDATE semantic_memory SET reference_count = ${5} WHERE id = ${highId}`;

    const browseByRefs = await getAppRuntime().listSemanticMemories({
      sort_by: "reference_count",
      limit: 100,
    });
    const probeIds = browseByRefs.items
      .filter((row: { content: string }) => row.content.includes("unique-sort-token"))
      .map((row: { id: string }) => row.id);
    expect(probeIds.indexOf(highId)).toBeLessThan(probeIds.indexOf(lowId));
    expect(
      browseByRefs.items.find((row: { id: string }) => row.id === highId)?.reference_count,
    ).toBe(5);

    const searched = await getAppRuntime().listSemanticMemories({
      query: "unique-sort-token",
      sort_by: "rank",
      limit: 10,
    });
    expect(
      searched.items.every((row: { reference_count: number }) => row.reference_count > 0),
    ).toBe(true);
    if (searched.items.length >= 2) {
      expect(searched.items[0]?.rank).toBeGreaterThanOrEqual(searched.items[1]?.rank ?? 0);
    }

    const forcedRank = await getAppRuntime().listSemanticMemories({
      query: "unique-sort-token",
      sort_by: "updated",
      limit: 10,
    });
    if (forcedRank.items.length >= 2) {
      expect(forcedRank.items[0]?.rank).toBeGreaterThanOrEqual(forcedRank.items[1]?.rank ?? 0);
    }
  });

  it("listLimbicMemories supports session and kind filter", async () => {
    const sid = "20260526_130000_limbic";
    await getTestEngine().repos.limbicMemory.create({
      session_id: sid,
      kind: "spike",
      content: "limbic probe spike content",
    });
    await getTestEngine().repos.limbicMemory.create({
      session_id: sid,
      kind: "session_mood",
      content: "limbic probe mood content",
    });

    const spikes = await getAppRuntime().listLimbicMemories({
      session_id: sid,
      kind: "spike",
    });
    expect(spikes.total).toBe(1);
    expect(spikes.items[0]?.kind).toBe("spike");

    const searched = await getAppRuntime().listLimbicMemories({
      query: "spike",
      session_id: sid,
    });
    expect(searched.total).toBe(1);
    expect(searched.items[0]?.content).toContain("spike");
  });

  it("listAutobiographicalMemories supports significance filter", async () => {
    await getTestEngine().repos.autobiographicalMemory.create({
      title: "Milestone event",
      content: "autobiography list probe milestone",
      significance: "milestone",
    });
    await getTestEngine().repos.autobiographicalMemory.create({
      title: "Daily record",
      content: "autobiography list probe normal",
      significance: "normal",
    });

    const milestones = await getAppRuntime().listAutobiographicalMemories({
      significance: "milestone",
    });
    expect(milestones.total).toBeGreaterThanOrEqual(1);
    expect(
      milestones.items.every((r: { significance: string }) => r.significance === "milestone"),
    ).toBe(true);

    const searched = await getAppRuntime().listAutobiographicalMemories({
      query: "milestone",
    });
    expect(searched.total).toBeGreaterThanOrEqual(1);
    expect(searched.items.some((r: { title: string }) => r.title.includes("Milestone"))).toBe(true);
  });

  it("updateSemanticMemoryPinned toggles pinned on active memory", async () => {
    const id = await getTestEngine().repos.semanticMemory.create({
      content: "service pin toggle probe",
      type: "preference",
    });

    const pinned = await getAppRuntime().updateSemanticMemoryPinned(id, true);
    expect(pinned).toEqual({ ok: true, id, pinned: true });
    expect((await getTestEngine().repos.semanticMemory.get(id))?.pinned).toBe(true);

    const unpinned = await getAppRuntime().updateSemanticMemoryPinned(id, false);
    expect(unpinned).toEqual({ ok: true, id, pinned: false });
    expect((await getTestEngine().repos.semanticMemory.get(id))?.pinned).toBe(false);
  });

  it("listSelfBlocks returns six blocks in order", async () => {
    await getTestEngine().repos.selfLayer.upsertBlock({
      block_key: "direction",
      content: "self layer list probe",
      updated_by: "test",
    });

    const { blocks } = await getAppRuntime().listSelfBlocks();
    expect(blocks.length).toBe(SELF_BLOCK_KEYS.length);
    expect(blocks.map((b: { block_key: string }) => b.block_key)).toEqual([...SELF_BLOCK_KEYS]);
    const direction = blocks.find((b: { block_key: string }) => b.block_key === "direction");
    expect(direction?.content).toBe("self layer list probe");
    expect(direction?.heading).toBe("Direction and intent");
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
