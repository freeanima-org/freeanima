import { afterAll, afterEach, beforeEach, expect, it } from "bun:test";

import {
  CONTENT_BLOCK_COMPONENT,
  LIMBIC_COMPONENT,
} from "@freeanima/habitat/core/db/schema/entity";
import { getEntity } from "@freeanima/habitat/core/db/pg/entity";
import { createLimbicBrick } from "@freeanima/habitat/core/db/pg/memory-brick";
import { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { createDiaryEntry } from "@freeanima/features/diary/domain";
import { registerContentBlockTools } from "@freeanima/features/content-block/domain";
import { getProfileHopModel } from "@freeanima/habitat/platform/config";
import { runWithToolContext } from "@freeanima/habitat/kernel/loop-mechanism";
import { getActiveRuntimeConfig } from "@freeanima/habitat/core/config";

import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { describePg } from "../../helpers/pg-test-gate.ts";
import { getActivePgTestContext, testConv } from "../../helpers/pg-test.ts";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/remote-tools-chat-test-platform.ts";
import { testAgentWorldId } from "../../helpers/world-context.ts";

function testCfg() {
  const ctx = getActivePgTestContext();
  if (!ctx) throw new Error("PG test context not initialized");
  return ctx.config.data;
}

describePg("content_block tool", () => {
  const prev = process.env.FREEANIMA_HOME;
  let toolSets: ToolSetRegistry;

  beforeEach(async () => {
    toolSets = new ToolSetRegistry();
    await beginIntegrationCase("anima-content-block-");
    registerContentBlockTools(toolSets);
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });

  it("CRUD + list by parent + limbic filter + reorder", async () => {
    const sid = "sess-content-block";
    await testConv().initConversation(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: TEST_SAP_CHAT_PLATFORM,
    });

    const worldId = testAgentWorldId();
    const diary = await createDiaryEntry(
      { worldId },
      {
        entry_at: "2026-07-17T10:00:00+08:00",
        title: "容器日",
      },
    );

    // 临时关 park，以便用 brick API 种 limbic 存量（对话写工具已删）
    const cfg = getActiveRuntimeConfig();
    const prevCutover = cfg.data.memory?.cutover;
    cfg.data.memory = {
      ...cfg.data.memory,
      cutover: { ...prevCutover, park_limbic_dream_narrative: false },
    };

    let limbicBrickId: number;
    try {
      const brick = await createLimbicBrick(worldId, {
        content: "第一块带情绪",
        valence: 0.2,
        arousal: 0.4,
        intensity: 0.6,
        day: "2026-07-17",
      });
      limbicBrickId = brick.id;
      // 挂到测试 diary：brick 会 ensure 同日 diary；若 id 不同则用 content_block 纯文本测 CRUD
    } finally {
      cfg.data.memory = {
        ...cfg.data.memory,
        cutover: prevCutover,
      };
    }

    let createOut = "";
    let parkedOut = "";
    await runWithToolContext(
      sid,
      async () => {
        const create = toolSets.getTool("content_block_create")!;
        parkedOut = await Promise.resolve(
          create.handler({
            parent_id: diary.id,
            block_type: "text",
            content: "应被 park",
            limbic: { valence: 0.1, arousal: 0.1, intensity: 0.5 },
          }),
        );
        createOut = await Promise.resolve(
          create.handler({
            parent_id: diary.id,
            block_type: "text",
            content: "第二块纯文本",
            sort_order: 20,
          }),
        );
      },
      { tools: toolSets },
    );

    const parked = JSON.parse(parkedOut) as { ok?: boolean; error?: string };
    expect(parked.error ?? "").toMatch(/park/i);
    expect(parked.ok).not.toBe(true);

    const created = JSON.parse(createOut) as {
      ok: boolean;
      item: { id: number; components: string[]; limbic: unknown };
    };
    expect(created.ok).toBe(true);
    expect(created.item.components).toContain(CONTENT_BLOCK_COMPONENT);
    expect(created.item.limbic).toBeNull();

    const limbicEntity = await getEntity(limbicBrickId!);
    expect(limbicEntity?.components).toContain(LIMBIC_COMPONENT);

    let listOut = "";
    let limbicListOut = "";
    let reorderOut = "";
    let deleteOut = "";
    await runWithToolContext(
      sid,
      async () => {
        const list = toolSets.getTool("content_block_list")!;
        listOut = await Promise.resolve(list.handler({ parent_id: diary.id }));
        limbicListOut = await Promise.resolve(
          list.handler({ parent_id: diary.id, component: "limbic" }),
        );

        const reorder = toolSets.getTool("content_block_reorder")!;
        const textId = created.item.id;
        reorderOut = await Promise.resolve(
          reorder.handler({
            items: [{ id: textId, sort_order: 2 }],
          }),
        );

        const del = toolSets.getTool("content_block_delete")!;
        deleteOut = await Promise.resolve(del.handler({ id: textId }));
      },
      { tools: toolSets },
    );

    const listed = JSON.parse(listOut) as {
      ok: boolean;
      count: number;
      items: Array<{ id: number }>;
    };
    expect(listed.ok).toBe(true);
    expect(listed.count).toBeGreaterThanOrEqual(1);

    const limbicListed = JSON.parse(limbicListOut) as {
      ok: boolean;
      count: number;
      items: Array<{ id: number }>;
    };
    expect(limbicListed.ok).toBe(true);
    // limbic brick 可能挂在 ensureDiary 的同日条目上，与本测试 diary 可能同 id
    if (limbicListed.count > 0) {
      expect(limbicListed.items.some((i) => i.id === limbicBrickId)).toBe(true);
    }

    const reordered = JSON.parse(reorderOut) as { ok: boolean };
    expect(reordered.ok).toBe(true);

    const deleted = JSON.parse(deleteOut) as { ok: boolean; action: string; id: number };
    expect(deleted.ok).toBe(true);
    expect(deleted.action).toBe("delete");
    expect(await getEntity(created.item.id)).toBeNull();
  });
});
