import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { randomUUID } from "node:crypto";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { runWithToolContext } from "@freeanima/habitat/kernel/loop-mechanism";
import { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { getProfileHopModel } from "@freeanima/habitat/platform/config";
import { registerTaskTools, getDefaultTaskList } from "@freeanima/features/task/domain";
import { createTag } from "@freeanima/features/tag/domain";
import { getEntity } from "@freeanima/habitat/core/db/pg/entity";
import {
  getActivePgTestContext,
  testConv,
  testAgentToolContextOpts,
  testChatAgentSubjectId,
} from "../../helpers/pg-test.ts";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/remote-tools-chat-test-platform.ts";
import { testAgentWorldId } from "../../helpers/world-context.ts";

function testCfg() {
  const ctx = getActivePgTestContext();
  if (!ctx) throw new Error("PG test context not initialized");
  return ctx.config.data;
}

describePg("tasks tool (core)", () => {
  const prev = process.env.FREEANIMA_HOME;
  let toolSets: ToolSetRegistry;

  beforeEach(async () => {
    toolSets = new ToolSetRegistry();
    await beginIntegrationCase("anima-tasks-");
    registerTaskTools(toolSets);
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  it("task_create writes entity task_item", async () => {
    const sid = "sess-task-create";
    await testConv().initConversation(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: TEST_SAP_CHAT_PLATFORM,
      agent_subject_id: testChatAgentSubjectId(),
    });

    const worldId = testAgentWorldId();
    const defaultList = await getDefaultTaskList(worldId);
    const work = await createTag(worldId, { title: "work" });

    let output = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("task_create")!;
        output = await Promise.resolve(
          tool.handler({
            title: "Discuss UI plan",
            priority: "high",
            content: "Details here",
            tag_ids: [work.id],
          }),
        );
      },
      testAgentToolContextOpts(toolSets),
    );

    const parsed = JSON.parse(output) as {
      ok: boolean;
      item: {
        id: number;
        title: string;
        content: string;
        tag_ids: number[];
        status: string;
        priority: string;
        list_id: number;
      };
    };
    expect(parsed.ok).toBe(true);
    expect(parsed.item.title).toBe("Discuss UI plan");
    expect(parsed.item.content).toBe("Details here");
    expect(parsed.item.tag_ids).toEqual([work.id]);
    expect(parsed.item.status).toBe("pending");
    expect(parsed.item.priority).toBe("high");
    expect(parsed.item.list_id).toBe(defaultList.id);

    const row = await getEntity(parsed.item.id);
    expect(row?.title).toBe("Discuss UI plan");
    expect(row?.content).toBe("Details here");
  });

  it("task_list defaults to pending only", async () => {
    const sid = "sess-task-list";
    await testConv().initConversation(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: TEST_SAP_CHAT_PLATFORM,
      agent_subject_id: testChatAgentSubjectId(),
    });

    let listId = 0;
    await runWithToolContext(
      sid,
      async () => {
        const createList = toolSets.getTool("tasklist_create")!;
        const listOut = await Promise.resolve(
          createList.handler({
            name: `pending-only-${randomUUID().slice(0, 8)}`,
          }),
        );
        listId = (JSON.parse(listOut) as { list: { id: number } }).list.id;

        const create = toolSets.getTool("task_create")!;
        const createOut = await Promise.resolve(
          create.handler({ title: "Active task", list_id: listId }),
        );
        const complete = toolSets.getTool("task_complete")!;
        const created = JSON.parse(createOut) as { item: { id: number } };
        await Promise.resolve(complete.handler({ id: created.item.id }));
        await Promise.resolve(create.handler({ title: "Pending task", list_id: listId }));
      },
      testAgentToolContextOpts(toolSets),
    );

    let output = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("task_list")!;
        output = await Promise.resolve(tool.handler({ list_id: listId }));
      },
      testAgentToolContextOpts(toolSets),
    );

    const parsed = JSON.parse(output) as {
      ok: boolean;
      count: number;
      items: { title: string }[];
    };
    expect(parsed.count).toBe(1);
    expect(parsed.items[0]?.title).toBe("Pending task");
  });

  it("task_complete updates status", async () => {
    const sid = "sess-task-complete";
    await testConv().initConversation(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: TEST_SAP_CHAT_PLATFORM,
      agent_subject_id: testChatAgentSubjectId(),
    });

    let createdId = 0;
    await runWithToolContext(
      sid,
      async () => {
        const create = toolSets.getTool("task_create")!;
        const out = await Promise.resolve(create.handler({ title: "Task to complete" }));
        createdId = (JSON.parse(out) as { item: { id: number } }).item.id;
      },
      testAgentToolContextOpts(toolSets),
    );

    let output = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("task_complete")!;
        output = await Promise.resolve(tool.handler({ id: createdId }));
      },
      testAgentToolContextOpts(toolSets),
    );

    const parsed = JSON.parse(output) as {
      ok: boolean;
      item: { status: string; completed_at: string | null };
    };
    expect(parsed.item.status).toBe("completed");
    expect(parsed.item.completed_at).not.toBeNull();
  });

  it("task_create accepts remind_at", async () => {
    const sid = "sess-task-remind";
    await testConv().initConversation(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: TEST_SAP_CHAT_PLATFORM,
      agent_subject_id: testChatAgentSubjectId(),
    });

    let output = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("task_create")!;
        output = await Promise.resolve(
          tool.handler({
            title: "Reminder task",
            due_at: "2026-07-01T18:00:00+08:00",
            remind_at: "2026-07-01T09:00:00+08:00",
          }),
        );
      },
      testAgentToolContextOpts(toolSets),
    );

    const parsed = JSON.parse(output) as { item: { remind_at: string | null } };
    expect(parsed.item.remind_at).toBe("2026-07-01T09:00:00+08:00");
  });

  it("tasklist_create and tasklist_delete", async () => {
    const sid = "sess-tasklist-crud";
    await testConv().initConversation(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: TEST_SAP_CHAT_PLATFORM,
      agent_subject_id: testChatAgentSubjectId(),
    });

    let createdId = 0;
    await runWithToolContext(
      sid,
      async () => {
        const create = toolSets.getTool("tasklist_create")!;
        const out = await Promise.resolve(create.handler({ name: "项目 Alpha" }));
        createdId = (JSON.parse(out) as { list: { id: number; name: string } }).list.id;
        expect((JSON.parse(out) as { list: { name: string } }).list.name).toBe("项目 Alpha");
      },
      testAgentToolContextOpts(toolSets),
    );

    let deleteOut = "";
    await runWithToolContext(
      sid,
      async () => {
        const del = toolSets.getTool("tasklist_delete")!;
        deleteOut = await Promise.resolve(del.handler({ id: createdId }));
      },
      testAgentToolContextOpts(toolSets),
    );
    expect(JSON.parse(deleteOut)).toEqual({ ok: true, action: "delete_list", id: createdId });
  });

  it("task_search omits list_id to search all lists", async () => {
    const sid = "sess-task-search";
    await testConv().initConversation(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: TEST_SAP_CHAT_PLATFORM,
      agent_subject_id: testChatAgentSubjectId(),
    });

    const listA = await getDefaultTaskList(testAgentWorldId());

    let listBId = 0;
    await runWithToolContext(
      sid,
      async () => {
        const createList = toolSets.getTool("tasklist_create")!;
        const listOut = await Promise.resolve(createList.handler({ name: "搜索清单 B" }));
        listBId = (JSON.parse(listOut) as { list: { id: number } }).list.id;

        const create = toolSets.getTool("task_create")!;
        await Promise.resolve(
          create.handler({
            title: "独特关键词任务",
            list_id: listA.id,
            content: "alpha",
          }),
        );
        await Promise.resolve(
          create.handler({
            title: "另一清单任务",
            list_id: listBId,
            content: "独特关键词",
          }),
        );
      },
      testAgentToolContextOpts(toolSets),
    );

    let output = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("task_search")!;
        output = await Promise.resolve(tool.handler({ query: "独特关键词" }));
      },
      testAgentToolContextOpts(toolSets),
    );

    const parsed = JSON.parse(output) as { count: number; items: { title: string }[] };
    expect(parsed.count).toBeGreaterThanOrEqual(2);
    expect(parsed.items.some((i) => i.title === "独特关键词任务")).toBe(true);
    expect(parsed.items.some((i) => i.title === "另一清单任务")).toBe(true);
  });

  it("task_search with list_id scopes to one list", async () => {
    const sid = "sess-task-search-list";
    await testConv().initConversation(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: TEST_SAP_CHAT_PLATFORM,
      agent_subject_id: testChatAgentSubjectId(),
    });

    const listA = await getDefaultTaskList(testAgentWorldId());

    let listBId = 0;
    await runWithToolContext(
      sid,
      async () => {
        const createList = toolSets.getTool("tasklist_create")!;
        const listOut = await Promise.resolve(createList.handler({ name: "限定清单" }));
        listBId = (JSON.parse(listOut) as { list: { id: number } }).list.id;

        const create = toolSets.getTool("task_create")!;
        await Promise.resolve(
          create.handler({
            title: "限定范围任务",
            list_id: listBId,
            content: "scope-test",
          }),
        );
        await Promise.resolve(
          create.handler({
            title: "默认清单任务",
            list_id: listA.id,
            content: "scope-test",
          }),
        );
      },
      testAgentToolContextOpts(toolSets),
    );

    let output = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("task_search")!;
        output = await Promise.resolve(tool.handler({ query: "scope-test", list_id: listBId }));
      },
      testAgentToolContextOpts(toolSets),
    );

    const parsed = JSON.parse(output) as { count: number; items: { title: string }[] };
    expect(parsed.count).toBe(1);
    expect(parsed.items[0]?.title).toBe("限定范围任务");
  });

  it("tasklist_search finds list by name", async () => {
    const sid = "sess-tasklist-search";
    await testConv().initConversation(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: TEST_SAP_CHAT_PLATFORM,
      agent_subject_id: testChatAgentSubjectId(),
    });

    await runWithToolContext(
      sid,
      async () => {
        const createList = toolSets.getTool("tasklist_create")!;
        await Promise.resolve(createList.handler({ name: "季度规划清单" }));
      },
      testAgentToolContextOpts(toolSets),
    );

    let output = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("tasklist_search")!;
        output = await Promise.resolve(tool.handler({ query: "季度规划" }));
      },
      testAgentToolContextOpts(toolSets),
    );

    const parsed = JSON.parse(output) as { count: number; lists: { name: string }[] };
    expect(parsed.count).toBeGreaterThanOrEqual(1);
    expect(parsed.lists.some((l) => l.name === "季度规划清单")).toBe(true);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
