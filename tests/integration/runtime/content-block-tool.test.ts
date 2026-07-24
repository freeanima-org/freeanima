import { afterAll, afterEach, beforeEach, expect, it } from "bun:test";

import { CONTENT_BLOCK_COMPONENT, LIMBIC_COMPONENT } from "@freeanima/host/core/db/schema/entity";
import { getEntity } from "@freeanima/host/core/db/pg/entity";
import { ToolSetRegistry } from "@freeanima/host/core/tool";
import { createDiaryEntry } from "@freeanima/features/diary/domain";
import { registerContentBlockTools } from "@freeanima/features/content-block/domain";
import { getProfileHopModel } from "@freeanima/host/platform/config";
import { runWithToolContext } from "@freeanima/host/engine/loop";

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

    let createOut = "";
    await runWithToolContext(
      sid,
      async () => {
        const create = toolSets.getTool("content_block_create")!;
        createOut = await Promise.resolve(
          create.handler({
            parent_id: diary.id,
            block_type: "text",
            content: "第一块带情绪",
            sort_order: 10,
            limbic: { valence: 0.2, arousal: 0.4, intensity: 0.6 },
          }),
        );
        await Promise.resolve(
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

    const created = JSON.parse(createOut) as {
      ok: boolean;
      item: { id: number; components: string[]; limbic: { valence: number } | null };
    };
    expect(created.ok).toBe(true);
    expect(created.item.components).toContain(CONTENT_BLOCK_COMPONENT);
    expect(created.item.components).toContain(LIMBIC_COMPONENT);
    expect(created.item.limbic?.valence).toBe(0.2);

    const row = await getEntity(created.item.id);
    expect(row?.primary_component).toBe(CONTENT_BLOCK_COMPONENT);
    expect(row?.content).toBe("第一块带情绪");

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
        const listed = JSON.parse(listOut) as { items: Array<{ id: number }> };
        reorderOut = await Promise.resolve(
          reorder.handler({
            items: [
              { id: listed.items[0]!.id, sort_order: 2 },
              { id: listed.items[1]!.id, sort_order: 1 },
            ],
          }),
        );

        const del = toolSets.getTool("content_block_delete")!;
        deleteOut = await Promise.resolve(del.handler({ id: created.item.id }));
      },
      { tools: toolSets },
    );

    const listed = JSON.parse(listOut) as {
      ok: boolean;
      count: number;
      items: Array<{ id: number }>;
    };
    expect(listed.ok).toBe(true);
    expect(listed.count).toBe(2);

    const limbicListed = JSON.parse(limbicListOut) as {
      ok: boolean;
      count: number;
      items: Array<{ id: number }>;
    };
    expect(limbicListed.ok).toBe(true);
    expect(limbicListed.count).toBe(1);
    expect(limbicListed.items[0]!.id).toBe(created.item.id);

    const reordered = JSON.parse(reorderOut) as {
      ok: boolean;
      items: Array<{ id: number; sort_order: number }>;
    };
    expect(reordered.ok).toBe(true);
    expect(reordered.items.find((i) => i.id === listed.items[0]!.id)?.sort_order).toBe(2);

    const deleted = JSON.parse(deleteOut) as { ok: boolean; action: string; id: number };
    expect(deleted.ok).toBe(true);
    expect(deleted.action).toBe("delete");
    expect(await getEntity(created.item.id)).toBeNull();
  });
});
