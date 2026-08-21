import { afterAll, afterEach, beforeEach, expect, it } from "bun:test";

import { CONTENT_BLOCK_COMPONENT } from "@freeanima/habitat/core/db/schema/entity";
import { getEntity } from "@freeanima/habitat/core/db/pg/entity";
import { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { createDiaryEntry } from "@freeanima/features/diary/domain";
import { registerContentBlockTools } from "@freeanima/features/content-block/domain";
import { getProfileHopModel } from "@freeanima/habitat/platform/config";
import { runWithToolContext } from "@freeanima/habitat/kernel/loop-mechanism";

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

  it("CRUD + list by parent + reorder；拒绝 limbic 写入", async () => {
    const sid = "sess-content-block";
    await testConv().initConversation(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: TEST_SAP_CHAT_PLATFORM,
      agent_subject_id: 2,
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
    let rejectedOut = "";
    await runWithToolContext(
      sid,
      async () => {
        const create = toolSets.getTool("content_block_create")!;
        rejectedOut = await Promise.resolve(
          create.handler({
            parent_id: diary.id,
            block_type: "text",
            content: "应被拒绝",
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

    const rejected = JSON.parse(rejectedOut) as { ok?: boolean; error?: string };
    expect(rejected.error ?? "").toMatch(/拆除|只读|limbic/i);
    expect(rejected.ok).not.toBe(true);

    const created = JSON.parse(createOut) as {
      ok: boolean;
      item: { id: number; components: string[]; limbic: unknown };
    };
    expect(created.ok).toBe(true);
    expect(created.item.components).toContain(CONTENT_BLOCK_COMPONENT);
    expect(created.item.limbic).toBeNull();

    let listOut = "";
    let reorderOut = "";
    let deleteOut = "";
    await runWithToolContext(
      sid,
      async () => {
        const list = toolSets.getTool("content_block_list")!;
        listOut = await Promise.resolve(list.handler({ parent_id: diary.id }));

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

    const reordered = JSON.parse(reorderOut) as { ok: boolean };
    expect(reordered.ok).toBe(true);

    const deleted = JSON.parse(deleteOut) as { ok: boolean; action: string; id: number };
    expect(deleted.ok).toBe(true);
    expect(deleted.action).toBe("delete");
    expect(await getEntity(created.item.id)).toBeNull();
  });
});
