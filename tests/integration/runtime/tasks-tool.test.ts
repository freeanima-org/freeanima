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
import { registerTaskTools, getDefaultTaskList } from "@freeanima/features/task/domain";
import { createProject } from "@freeanima/features/project/domain";
import { createTag } from "@freeanima/features/tag/domain";
import { getEntity } from "@freeanima/core/db/pg/entity";
import { getActivePgTestContext, testConv } from "../../helpers/pg-test.ts";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/sap-chat-test-platform.ts";
import { testAgentWorldId } from "../../helpers/world-context.ts";
import { getResolvedWorldContext } from "@freeanima/core/config/world-context";

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
    registerTaskTools(toolSets);
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });

  it("task_create writes entity task_item", async () => {
    const sid = "sess-task-create";
    await testConv().initConversation(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: TEST_SAP_CHAT_PLATFORM,
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
      { tools: toolSets },
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
    });

    const list = await getDefaultTaskList(testAgentWorldId());

    let createOut = "";
    await runWithToolContext(
      sid,
      async () => {
        const create = toolSets.getTool("task_create")!;
        createOut = await Promise.resolve(
          create.handler({ title: "Active task", list_id: list.id }),
        );
        const complete = toolSets.getTool("task_complete")!;
        const created = JSON.parse(createOut) as { item: { id: number } };
        await Promise.resolve(complete.handler({ id: created.item.id }));
        await Promise.resolve(create.handler({ title: "Pending task", list_id: list.id }));
      },
      { tools: toolSets },
    );

    let output = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("task_list")!;
        output = await Promise.resolve(tool.handler({ list_id: list.id }));
      },
      { tools: toolSets },
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
    });

    let createdId = 0;
    await runWithToolContext(
      sid,
      async () => {
        const create = toolSets.getTool("task_create")!;
        const out = await Promise.resolve(create.handler({ title: "Task to complete" }));
        createdId = (JSON.parse(out) as { item: { id: number } }).item.id;
      },
      { tools: toolSets },
    );

    let output = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("task_complete")!;
        output = await Promise.resolve(tool.handler({ id: createdId }));
      },
      { tools: toolSets },
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
    });

    let output = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("task_create")!;
        output = await Promise.resolve(
          tool.handler({
            title: "Reminder task",
            remind_at: "2026-07-01T09:00:00+08:00",
          }),
        );
      },
      { tools: toolSets },
    );

    const parsed = JSON.parse(output) as { item: { remind_at: string | null } };
    expect(parsed.item.remind_at).toBe("2026-07-01T09:00:00+08:00");
  });

  it("tasklist_create and tasklist_delete", async () => {
    const sid = "sess-tasklist-crud";
    await testConv().initConversation(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: TEST_SAP_CHAT_PLATFORM,
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
      { tools: toolSets },
    );

    let deleteOut = "";
    await runWithToolContext(
      sid,
      async () => {
        const del = toolSets.getTool("tasklist_delete")!;
        deleteOut = await Promise.resolve(del.handler({ id: createdId }));
      },
      { tools: toolSets },
    );
    expect(JSON.parse(deleteOut)).toEqual({ ok: true, action: "delete_list", id: createdId });
  });

  it("task_search omits list_id to search all lists", async () => {
    const sid = "sess-task-search";
    await testConv().initConversation(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: TEST_SAP_CHAT_PLATFORM,
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
          create.handler({ title: "独特关键词任务", list_id: listA.id, content: "alpha" }),
        );
        await Promise.resolve(
          create.handler({
            title: "另一清单任务",
            list_id: listBId,
            content: "独特关键词",
          }),
        );
      },
      { tools: toolSets },
    );

    let output = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("task_search")!;
        output = await Promise.resolve(tool.handler({ query: "独特关键词" }));
      },
      { tools: toolSets },
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
      { tools: toolSets },
    );

    let output = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("task_search")!;
        output = await Promise.resolve(tool.handler({ query: "scope-test", list_id: listBId }));
      },
      { tools: toolSets },
    );

    const parsed = JSON.parse(output) as { count: number; items: { title: string }[] };
    expect(parsed.count).toBe(1);
    expect(parsed.items[0]?.title).toBe("限定范围任务");
  });

  it("tasklist_search finds list by name", async () => {
    const sid = "sess-tasklist-search";
    await testConv().initConversation(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: TEST_SAP_CHAT_PLATFORM,
    });

    await runWithToolContext(
      sid,
      async () => {
        const createList = toolSets.getTool("tasklist_create")!;
        await Promise.resolve(createList.handler({ name: "季度规划清单" }));
      },
      { tools: toolSets },
    );

    let output = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("tasklist_search")!;
        output = await Promise.resolve(tool.handler({ query: "季度规划" }));
      },
      { tools: toolSets },
    );

    const parsed = JSON.parse(output) as { count: number; lists: { name: string }[] };
    expect(parsed.count).toBeGreaterThanOrEqual(1);
    expect(parsed.lists.some((l) => l.name === "季度规划清单")).toBe(true);
  });

  it("task_list by list_id without world_id with MCP callerAuth", async () => {
    const sid = "sess-mcp-caller-auth";
    const list = await getDefaultTaskList(testAgentWorldId());
    const agentSubjectId = getResolvedWorldContext().agent_subject_id;

    let output = "";
    await runWithToolContext(
      sid,
      async () => {
        const create = toolSets.getTool("task_create")!;
        await Promise.resolve(create.handler({ title: "MCP scoped task", list_id: list.id }));
        const tool = toolSets.getTool("task_list")!;
        output = await Promise.resolve(tool.handler({ list_id: list.id, status: "all" }));
      },
      {
        tools: toolSets,
        contextKind: "auto_llm",
        callerAuth: {
          token_id: 1,
          subject_id: agentSubjectId,
          subject_type: "agent",
          scopes: ["full"],
        },
      },
    );

    const parsed = JSON.parse(output) as { ok: boolean; count: number };
    expect(parsed.ok).toBe(true);
    expect(parsed.count).toBeGreaterThanOrEqual(1);
  });

  it("task_list filters by project_id and rejects list_id combo", async () => {
    const sid = "sess-task-list-project";
    await testConv().initConversation(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: TEST_SAP_CHAT_PLATFORM,
    });

    const worldId = testAgentWorldId();
    const list = await getDefaultTaskList(worldId);
    const project = await createProject(worldId, {
      title: "Tool project filter",
      start_at: "2026-01-01T00:00:00.000Z",
      end_at: "2026-12-31T00:00:00.000Z",
    });

    let createdId = 0;
    await runWithToolContext(
      sid,
      async () => {
        const create = toolSets.getTool("task_create")!;
        const out = await Promise.resolve(
          create.handler({
            title: "In-project task",
            project_id: project.id,
          }),
        );
        createdId = (JSON.parse(out) as { item: { id: number } }).item.id;
      },
      { tools: toolSets },
    );

    let backlogOut = "";
    let projectOut = "";
    let conflictOut = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("task_list")!;
        backlogOut = await Promise.resolve(tool.handler({ list_id: list.id }));
        projectOut = await Promise.resolve(tool.handler({ project_id: project.id }));
        conflictOut = await Promise.resolve(
          tool.handler({ project_id: project.id, list_id: list.id }),
        );
      },
      { tools: toolSets },
    );

    const backlog = JSON.parse(backlogOut) as { items: { id: number }[] };
    expect(backlog.items.some((item) => item.id === createdId)).toBe(false);

    const byProject = JSON.parse(projectOut) as {
      ok: boolean;
      count: number;
      items: { id: number; title: string; project_id: number | null }[];
    };
    expect(byProject.ok).toBe(true);
    expect(byProject.count).toBe(1);
    expect(byProject.items[0]?.id).toBe(createdId);
    expect(byProject.items[0]?.title).toBe("In-project task");
    expect(byProject.items[0]?.project_id).toBe(project.id);

    const conflict = JSON.parse(conflictOut) as { error?: string };
    expect(conflict.error).toContain("mutually exclusive");
  });
});
