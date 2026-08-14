import { afterAll, afterEach, beforeEach, expect, it } from "bun:test";

import { getEntity } from "@freeanima/habitat/core/db/pg/entity";
import {
  appendDiaryEntry,
  createDiaryEntry,
  createDiaryTextBlock,
  deleteDiaryEntry,
  getDiaryEntry,
  reorderDiaryTextBlocks,
  searchDiaryEntries,
} from "@freeanima/features/diary/domain";

import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { describePg } from "../../helpers/pg-test-gate.ts";
import { testAgentWorldId } from "../../helpers/world-context.ts";

describePg("diary container + text blocks", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("anima-diary-blocks-");
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });

  it("create with content → first text block; append → new block; delete cascades", async () => {
    const worldId = testAgentWorldId();
    const ctx = { worldId };

    const entry = await createDiaryEntry(ctx, {
      title: "测试日",
      entry_at: "2026-07-17T12:00:00+08:00",
      content: "首段正文",
    });

    const container = await getEntity(entry.id);
    expect(container?.content).toBe("");
    expect(entry.blocks).toHaveLength(1);
    expect(entry.blocks[0]?.content).toBe("首段正文");
    expect(entry.blocks[0]?.sort_order).toBe(0);

    const appended = await appendDiaryEntry(ctx, { id: entry.id, content: "第二段" });
    expect(appended?.blocks).toHaveLength(2);
    expect(appended?.blocks.map((b) => b.content)).toEqual(["首段正文", "第二段"]);

    const second = await createDiaryTextBlock(ctx, {
      parent_id: entry.id,
      content: "第三段",
    });
    expect(second.sort_order).toBe(2);

    const reordered = await reorderDiaryTextBlocks(ctx, [
      { id: second.id, sort_order: 0 },
      { id: entry.blocks[0]!.id, sort_order: 1 },
      { id: appended!.blocks[1]!.id, sort_order: 2 },
    ]);
    expect(reordered.toSorted((a, b) => a.sort_order - b.sort_order).map((b) => b.content)).toEqual(
      ["第三段", "首段正文", "第二段"],
    );

    const found = await searchDiaryEntries(ctx, { query: "第二段", limit: 10 });
    expect(found.some((e) => e.id === entry.id)).toBe(true);

    const ok = await deleteDiaryEntry(ctx, entry.id);
    expect(ok).toBe(true);
    expect(await getDiaryEntry(ctx, entry.id)).toBeNull();
    expect(await getEntity(entry.blocks[0]!.id)).toBeNull();
    expect(await getEntity(appended!.blocks[1]!.id)).toBeNull();
    expect(await getEntity(second.id)).toBeNull();
  });
});
