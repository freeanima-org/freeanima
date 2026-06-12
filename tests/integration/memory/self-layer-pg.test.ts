import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { getTestEngine } from "../../helpers/pg-test.ts";
import { SELF_BLOCK_KEYS } from "@freeanima/storage-repos";
import { buildAutobiographySummary } from "@freeanima/capabilities-memory/autobiography/run";

describePg("self layer PG", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-self-");
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  it("self_blocks CRUD + locked existence_anchor", async () => {
    const store = getTestEngine().repos.selfLayer;

    await store.upsertBlock({
      block_key: "self_model",
      content: "I am a test agent.",
      updated_by: "test",
    });

    const row = await store.getBlock("self_model");
    expect(row?.content).toBe("I am a test agent.");
    expect(row?.version).toBeGreaterThanOrEqual(1);

    const blocks = await store.listBlocks();
    expect(blocks.map((b) => b.block_key)).toEqual([...SELF_BLOCK_KEYS]);

    await store.upsertBlock({
      block_key: "existence_anchor",
      content: "existence anchor content",
      locked: true,
      updated_by: "test",
    });

    await expect(
      store.updateBlock({ block_key: "existence_anchor", content: "tamper" }),
    ).rejects.toThrow(/locked/i);

    await store.updateBlock(
      { block_key: "existence_anchor", content: "explicit update", updated_by: "test" },
      { force: true },
    );
    const anchor = await store.getBlock("existence_anchor");
    expect(anchor?.content).toBe("explicit update");
  });

  it("autobiographical_memory append-only + summary", async () => {
    const auto = getTestEngine().repos.autobiographicalMemory;
    const self = getTestEngine().repos.selfLayer;

    const id = await auto.create({
      title: "First boundary test",
      content: "I realized that saying no is also a choice.",
      significance: "turning_point",
      source_semantic_memory: ["f-000001-abcd"],
    });
    expect(id.length).toBeGreaterThan(0);

    const row = await auto.get(id);
    expect(row?.status).toBe("active");
    expect(row?.significance).toBe("turning_point");

    const summary = buildAutobiographySummary([row!]);
    expect(summary).toContain("First boundary test");

    await self.upsertBlock({
      block_key: "autobiography_summary",
      content: summary,
      updated_by: "test",
    });
    const block = await self.getBlock("autobiography_summary");
    expect(block?.content).toContain("Turning point");

    const deprecated = await auto.deprecate(id);
    expect(deprecated).toBe(true);
    expect((await auto.get(id))?.status).toBe("deprecated");
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
