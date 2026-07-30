import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { SELF_BLOCK_KEYS } from "@freeanima/host/core/db/pg/self-layer/types";
import { buildAutobiographySummary } from "@freeanima/host/capabilities/memory/autobiography/run";
import {
  createAutobiographicalMemory,
  deprecateAutobiographicalMemory,
  getAutobiographicalMemory,
} from "@freeanima/host/core/db/pg/autobiographical-memory";
import {
  getSelfBlock,
  listSelfBlocks,
  updateSelfBlock,
  upsertSelfBlock,
} from "@freeanima/host/core/db/pg/self-layer";

describePg("self layer PG", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-self-");
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  it("self_blocks CRUD + locked existence_anchor", async () => {
    await upsertSelfBlock({
      block_key: "self_model",
      content: "I am a test agent.",
      updated_by: "test",
    });

    const row = await getSelfBlock("self_model");
    expect(row?.content).toBe("I am a test agent.");
    expect(row?.version).toBeGreaterThanOrEqual(1);

    const blocks = await listSelfBlocks();
    expect(blocks.map((b) => b.block_key)).toEqual([...SELF_BLOCK_KEYS]);

    await upsertSelfBlock({
      block_key: "existence_anchor",
      content: "existence anchor content",
      locked: true,
      updated_by: "test",
    });

    await expect(
      updateSelfBlock({ block_key: "existence_anchor", content: "tamper" }),
    ).rejects.toThrow(/locked/i);

    await updateSelfBlock(
      { block_key: "existence_anchor", content: "explicit update", updated_by: "test" },
      { force: true },
    );
    const anchor = await getSelfBlock("existence_anchor");
    expect(anchor?.content).toBe("explicit update");
  });

  it("autobiographical_memory append-only (historical narrative retained read-only)", async () => {
    const id = await createAutobiographicalMemory({
      title: "First boundary test",
      content: "I realized that saying no is also a choice.",
      significance: "turning_point",
      source_semantic_memory: [1001],
    });
    expect(id.length).toBeGreaterThan(0);

    const row = await getAutobiographicalMemory(id);
    expect(row?.status).toBe("active");
    expect(row?.significance).toBe("turning_point");

    const summary = buildAutobiographySummary([row!]);
    expect(summary).toContain("First boundary test");
    expect(summary).toContain("## Turning points");

    const deprecated = await deprecateAutobiographicalMemory(id);
    expect(deprecated).toBe(true);
    expect((await getAutobiographicalMemory(id))?.status).toBe("deprecated");
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
