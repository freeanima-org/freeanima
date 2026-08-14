import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { getActiveRuntimeConfig } from "@freeanima/habitat/core/config";
import { SELF_BLOCK_KEYS } from "@freeanima/habitat/core/db/pg/self-layer/types";
import { buildAutobiographySummary } from "@freeanima/habitat/capabilities/memory/autobiography/run";
import {
  createAutobiographicalMemory,
  deprecateAutobiographicalMemory,
  getAutobiographicalMemory,
} from "@freeanima/habitat/core/db/pg/autobiographical-memory";
import {
  getSelfBlock,
  listSelfBlocks,
  updateSelfBlock,
  upsertSelfBlock,
} from "@freeanima/habitat/core/db/pg/self-layer";

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
    // 临时关 park，以便用 brick API 验证 append-only / deprecate 契约（默认 park 停写 narrative）
    const cfg = getActiveRuntimeConfig();
    const prevCutover = cfg.data.memory?.cutover;
    cfg.data.memory = {
      ...cfg.data.memory,
      cutover: { ...prevCutover, park_limbic_dream_narrative: false },
    };

    try {
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
    } finally {
      cfg.data.memory = {
        ...cfg.data.memory,
        cutover: prevCutover,
      };
    }
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
