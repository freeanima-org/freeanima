import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { runWithToolContext } from "@freeanima/runtime/loop";
import { ToolSetRegistry } from "@freeanima/core/tool";
import { getProfileHopModel } from "@freeanima/platform/config";
import {
  registerEntityTaskModule,
  registerTaskTools,
  resetEntityTaskModuleForTests,
  getDefaultTaskList,
} from "@freeanima/capabilities-task";
import { getActivePgTestContext, testConv } from "../../helpers/pg-test.ts";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/sap-chat-test-platform.ts";

function testCfg() {
  const ctx = getActivePgTestContext();
  if (!ctx) throw new Error("PG test context not initialized");
  return ctx.config.data;
}

describePg("tasks tool", () => {
  const prev = process.env.FREEANIMA_HOME;
  let toolSets: ToolSetRegistry;

  beforeEach(async () => {
    toolSets = new ToolSetRegistry();
    await beginIntegrationCase("anima-tasks-");
    resetEntityTaskModuleForTests();
    registerEntityTaskModule({
      entityStore: testConv().repos.entity,
      entitySearch: testConv().repos.entitySearch,
    });
    registerTaskTools(toolSets);
  });

  afterEach(async () => {
    resetEntityTaskModuleForTests();
    await restoreIntegrationHome(prev);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });

  it("task_create writes entity task_item", async () => {
    const sid = "sess-task-create";
    const repos = testConv().repos;
    await testConv().initConversation(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: TEST_SAP_CHAT_PLATFORM,
    });

    const defaultList = await getDefaultTaskList();
    expect(defaultList).not.toBeNull();

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
            tags: ["work"],
          }),
        );
      },
      { repos, tools: toolSets },
    );

    const parsed = JSON.parse(output) as {
      ok: boolean;
      item: {
        id: number;
        title: string;
        content: string;
        tags: string[];
        status: string;
        priority: string;
        list_id: number;
      };
    };
    expect(parsed.ok).toBe(true);
    expect(parsed.item.title).toBe("Discuss UI plan");
    expect(parsed.item.content).toBe("Details here");
    expect(parsed.item.tags).toEqual(["work"]);
    expect(parsed.item.status).toBe("pending");
    expect(parsed.item.priority).toBe("high");
    expect(parsed.item.list_id).toBe(defaultList!.id);

    const row = await repos.entity.get(parsed.item.id);
    expect(row?.title).toBe("Discuss UI plan");
    expect(row?.content).toBe("Details here");
  });

  it("task_list defaults to pending only", async () => {
    const sid = "sess-task-list";
    const repos = testConv().repos;
    await testConv().initConversation(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: TEST_SAP_CHAT_PLATFORM,
    });

    const list = await getDefaultTaskList();
    expect(list).not.toBeNull();

    let createOut = "";
    await runWithToolContext(
      sid,
      async () => {
        const create = toolSets.getTool("task_create")!;
        createOut = await Promise.resolve(
          create.handler({ title: "Active task", list_id: list!.id }),
        );
        const complete = toolSets.getTool("task_complete")!;
        const created = JSON.parse(createOut) as { item: { id: number } };
        await Promise.resolve(complete.handler({ id: created.item.id }));
        await Promise.resolve(create.handler({ title: "Pending task", list_id: list!.id }));
      },
      { repos, tools: toolSets },
    );

    let output = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("task_list")!;
        output = await Promise.resolve(tool.handler({ list_id: list!.id }));
      },
      { repos, tools: toolSets },
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
    const repos = testConv().repos;
    await testConv().initConversation(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: TEST_SAP_CHAT_PLATFORM,
    });

    let createdId = 0;
    await runWithToolContext(
      sid,
      async () => {
        const create = toolSets.getTool("task_create")!;
        const out = await Promise.resolve(create.handler({ title: "Task to complete" }));
        createdId = (JSON.parse(out) as { item: { id: number } }).item.id;
      },
      { repos, tools: toolSets },
    );

    let output = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("task_complete")!;
        output = await Promise.resolve(tool.handler({ id: createdId }));
      },
      { repos, tools: toolSets },
    );

    const parsed = JSON.parse(output) as {
      ok: boolean;
      item: { status: string; completed_at: string | null };
    };
    expect(parsed.item.status).toBe("completed");
    expect(parsed.item.completed_at).not.toBeNull();
  });
});
