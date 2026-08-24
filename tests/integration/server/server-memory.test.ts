import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { randomUUID } from "node:crypto";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { getAppRuntime } from "@freeanima/habitat/platform";
import { SELF_BLOCK_KEYS } from "@freeanima/habitat/core/db/pg/self-layer/types";
import {
  createSemanticMemory,
  getSemanticMemory,
} from "@freeanima/habitat/core/db/pg/semantic-memory";
import { upsertSelfBlock } from "@freeanima/habitat/core/db/pg/self-layer";
import { countSemanticMemory } from "@freeanima/habitat/core/db/pg/semantic-memory";
import { setSearchDocumentClusterId } from "@freeanima/habitat/core/db/pg/search";
import { getActivePgTestContext } from "../../helpers/pg-test.ts";

describePg("server memory API", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-memapi-");
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  it("passiveRecallDebug returns semantic pipeline debug for a query", async () => {
    await createSemanticMemory({
      content: "Freeanima memory pipeline uses compression",
      type: "world",
    });

    const out = await getAppRuntime().passiveRecallDebug({
      user_text: "compression",
      limit: 5,
    });
    expect(out.debug.query).toBe("compression");
    expect(out.enabled).toBe(true);
    expect(Array.isArray(out.debug.fts)).toBe(true);
    expect(Array.isArray(out.debug.merged)).toBe(true);
  });

  it("countSemanticMemory returns semantic memory count", async () => {
    await createSemanticMemory({
      content: "semantic memory count probe gamma",
      type: "world",
    });

    const index_rows = await countSemanticMemory();
    expect(index_rows).toBeGreaterThan(0);
    const hits = await getAppRuntime().passiveRecallDebug({ user_text: "gamma" });
    expect(
      hits.debug.after_score_filter.some((r: { id: number }) => r.id > 0) ||
        hits.debug.merged.some((r: { id: number }) => r.id > 0),
    ).toBe(true);
  });

  it("listSemanticMemories supports filter offset and total", async () => {
    await createSemanticMemory({
      content: "list probe alpha unique-token",
      type: "preference",
    });
    await createSemanticMemory({
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
    const token = `unique-sort-${randomUUID().slice(0, 8)}`;
    const lowId = await createSemanticMemory({
      content: `sort probe low refs ${token}`,
      type: "world",
    });
    const highId = await createSemanticMemory({
      content: `sort probe high refs ${token}`,
      type: "world",
    });

    const ctx = getActivePgTestContext();
    if (!ctx) throw new Error("PG test context missing");
    await ctx.sql`UPDATE entities SET reference_count = ${1} WHERE id = ${lowId} AND primary_component = 'semantic_memory'`;
    await ctx.sql`UPDATE entities SET reference_count = ${5} WHERE id = ${highId} AND primary_component = 'semantic_memory'`;

    expect((await getSemanticMemory(lowId))?.reference_count).toBe(1);
    expect((await getSemanticMemory(highId))?.reference_count).toBe(5);

    // 无 query 时才尊重 sort_by=reference_count（有 query 会强制 rank）
    const browseByRefs = await getAppRuntime().listSemanticMemories({
      sort_by: "reference_count",
      limit: 100,
    });
    const probeIds = browseByRefs.items
      .filter((row: { content: string }) => row.content.includes(token))
      .map((row: { id: number }) => row.id);
    expect(probeIds).toEqual([highId, lowId]);
    expect(
      browseByRefs.items.find((row: { id: number }) => row.id === highId)?.reference_count,
    ).toBe(5);

    const searched = await getAppRuntime().listSemanticMemories({
      query: token,
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
      query: token,
      sort_by: "updated_at",
      limit: 10,
    });
    if (forcedRank.items.length >= 2) {
      expect(forcedRank.items[0]?.rank).toBeGreaterThanOrEqual(forcedRank.items[1]?.rank ?? 0);
    }
  });

  it("updateSemanticMemoryPinned toggles pinned on active memory", async () => {
    const id = await createSemanticMemory({
      content: "service pin toggle probe",
      type: "preference",
    });

    const pinned = await getAppRuntime().updateSemanticMemoryPinned(id, true);
    expect(pinned).toEqual({ ok: true, id, pinned: true });
    expect((await getSemanticMemory(id))?.pinned).toBe(true);

    const unpinned = await getAppRuntime().updateSemanticMemoryPinned(id, false);
    expect(unpinned).toEqual({ ok: true, id, pinned: false });
    expect((await getSemanticMemory(id))?.pinned).toBe(false);
  });

  it("listSemanticMemories exposes cluster_id and supports cluster filter", async () => {
    const token = `cluster-list-${randomUUID().slice(0, 8)}`;
    const idA = await createSemanticMemory({
      content: `cluster probe a ${token}`,
      type: "world",
    });
    const idB = await createSemanticMemory({
      content: `cluster probe b ${token}`,
      type: "world",
    });
    const idC = await createSemanticMemory({
      content: `cluster probe c ${token}`,
      type: "world",
    });

    const okA = await setSearchDocumentClusterId("entity", idA, 7);
    const okB = await setSearchDocumentClusterId("entity", idB, 7);
    const okC = await setSearchDocumentClusterId("entity", idC, 9);
    expect(okA && okB && okC).toBe(true);

    const browse = await getAppRuntime().listSemanticMemories({
      limit: 100,
      sort_by: "updated_at",
    });
    const byId = new Map(
      browse.items
        .filter((row: { content: string }) => row.content.includes(token))
        .map((row: { id: number; cluster_id: number | null }) => [row.id, row.cluster_id]),
    );
    expect(byId.get(idA)).toBe(7);
    expect(byId.get(idB)).toBe(7);
    expect(byId.get(idC)).toBe(9);

    const filtered = await getAppRuntime().listSemanticMemories({
      cluster_id: 7,
      limit: 100,
    });
    const filteredIds = filtered.items
      .filter((row: { content: string }) => row.content.includes(token))
      .map((row: { id: number }) => row.id)
      .toSorted((a: number, b: number) => a - b);
    expect(filteredIds).toEqual([idA, idB].toSorted((a, b) => a - b));
    expect(filtered.items.every((row: { cluster_id: number | null }) => row.cluster_id === 7)).toBe(
      true,
    );

    const ungroupedId = await createSemanticMemory({
      content: `cluster probe ungrouped ${token}`,
      type: "world",
    });
    const ungrouped = await getAppRuntime().listSemanticMemories({
      cluster_id: null,
      limit: 100,
    });
    expect(
      ungrouped.items.some(
        (row: { id: number; cluster_id: number | null }) =>
          row.id === ungroupedId && row.cluster_id == null,
      ),
    ).toBe(true);
    expect(
      ungrouped.items
        .filter((row: { content: string }) => row.content.includes(token))
        .every((row: { cluster_id: number | null }) => row.cluster_id == null),
    ).toBe(true);

    const clusters = await getAppRuntime().listSemanticMemoryClusters();
    const seven = clusters.items.find((row) => row.cluster_id === 7);
    expect(seven?.count).toBeGreaterThanOrEqual(2);

    const { getResolvedWorldContext } =
      await import("@freeanima/habitat/core/config/world-context");
    const agentId = getResolvedWorldContext().default_chat_agent_subject_id;
    const scopedClusters = await getAppRuntime().listSemanticMemoryClusters({
      agent_subject_id: agentId,
    });
    const scopedSeven = scopedClusters.items.find((row) => row.cluster_id === 7);
    expect(scopedSeven?.count).toBeGreaterThanOrEqual(2);
    expect(scopedClusters.items.find((row) => row.cluster_id === 9)?.count).toBeGreaterThanOrEqual(
      1,
    );
  });

  it("listSelfBlocks returns five blocks in order", async () => {
    const { getResolvedWorldContext } =
      await import("@freeanima/habitat/core/config/world-context");
    const agentId = getResolvedWorldContext().default_chat_agent_subject_id;
    await upsertSelfBlock(
      {
        block_key: "direction",
        content: "self layer list probe",
        updated_by: "test",
      },
      agentId,
    );

    const { blocks } = await getAppRuntime().listSelfBlocks(agentId);
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
