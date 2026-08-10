import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { randomUUID } from "node:crypto";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { runWithToolContext } from "@freeanima/host/engine/loop";
import { ToolSetRegistry } from "@freeanima/host/core/tool";
import { getProfileHopModel } from "@freeanima/host/platform/config";
import { registerTaskTools, getDefaultTaskList } from "@freeanima/features/task/domain";
import { createProject } from "@freeanima/features/project/domain";
import { createTag, listTags } from "@freeanima/features/tag/domain";
import { getEntity } from "@freeanima/host/core/db/pg/entity";
import { getActivePgTestContext, testConv } from "../../helpers/pg-test.ts";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/remote-tools-chat-test-platform.ts";
import { testAgentWorldId } from "../../helpers/world-context.ts";
import { getResolvedWorldContext } from "@freeanima/host/core/config/world-context";

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
            subject_kind: "agent",
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

    let listId = 0;
    await runWithToolContext(
      sid,
      async () => {
        const createList = toolSets.getTool("tasklist_create")!;
        const listOut = await Promise.resolve(
          createList.handler({
            subject_kind: "agent",
            name: `pending-only-${randomUUID().slice(0, 8)}`,
          }),
        );
        listId = (JSON.parse(listOut) as { list: { id: number } }).list.id;

        const create = toolSets.getTool("task_create")!;
        const createOut = await Promise.resolve(
          create.handler({ subject_kind: "agent", title: "Active task", list_id: listId }),
        );
        const complete = toolSets.getTool("task_complete")!;
        const created = JSON.parse(createOut) as { item: { id: number } };
        await Promise.resolve(complete.handler({ subject_kind: "agent", id: created.item.id }));
        await Promise.resolve(
          create.handler({ subject_kind: "agent", title: "Pending task", list_id: listId }),
        );
      },
      { tools: toolSets },
    );

    let output = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("task_list")!;
        output = await Promise.resolve(tool.handler({ subject_kind: "agent", list_id: listId }));
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
        const out = await Promise.resolve(
          create.handler({ subject_kind: "agent", title: "Task to complete" }),
        );
        createdId = (JSON.parse(out) as { item: { id: number } }).item.id;
      },
      { tools: toolSets },
    );

    let output = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("task_complete")!;
        output = await Promise.resolve(tool.handler({ subject_kind: "agent", id: createdId }));
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
            subject_kind: "agent",
            title: "Reminder task",
            due_at: "2026-07-01T18:00:00+08:00",
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
        const out = await Promise.resolve(
          create.handler({ subject_kind: "agent", name: "项目 Alpha" }),
        );
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
        deleteOut = await Promise.resolve(del.handler({ subject_kind: "agent", id: createdId }));
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
        const listOut = await Promise.resolve(
          createList.handler({ subject_kind: "agent", name: "搜索清单 B" }),
        );
        listBId = (JSON.parse(listOut) as { list: { id: number } }).list.id;

        const create = toolSets.getTool("task_create")!;
        await Promise.resolve(
          create.handler({
            subject_kind: "agent",
            title: "独特关键词任务",
            list_id: listA.id,
            content: "alpha",
          }),
        );
        await Promise.resolve(
          create.handler({
            subject_kind: "agent",
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
        output = await Promise.resolve(
          tool.handler({ subject_kind: "agent", query: "独特关键词" }),
        );
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
        const listOut = await Promise.resolve(
          createList.handler({ subject_kind: "agent", name: "限定清单" }),
        );
        listBId = (JSON.parse(listOut) as { list: { id: number } }).list.id;

        const create = toolSets.getTool("task_create")!;
        await Promise.resolve(
          create.handler({
            subject_kind: "agent",
            title: "限定范围任务",
            list_id: listBId,
            content: "scope-test",
          }),
        );
        await Promise.resolve(
          create.handler({
            subject_kind: "agent",
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
        output = await Promise.resolve(
          tool.handler({ subject_kind: "agent", query: "scope-test", list_id: listBId }),
        );
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
        await Promise.resolve(createList.handler({ subject_kind: "agent", name: "季度规划清单" }));
      },
      { tools: toolSets },
    );

    let output = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("tasklist_search")!;
        output = await Promise.resolve(tool.handler({ subject_kind: "agent", query: "季度规划" }));
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
        await Promise.resolve(
          create.handler({ subject_kind: "agent", title: "MCP scoped task", list_id: list.id }),
        );
        const tool = toolSets.getTool("task_list")!;
        output = await Promise.resolve(
          tool.handler({ subject_kind: "agent", list_id: list.id, status: "all" }),
        );
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
            subject_kind: "agent",
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
        backlogOut = await Promise.resolve(
          tool.handler({ subject_kind: "agent", list_id: list.id }),
        );
        projectOut = await Promise.resolve(
          tool.handler({ subject_kind: "agent", project_id: project.id }),
        );
        conflictOut = await Promise.resolve(
          tool.handler({ subject_kind: "agent", project_id: project.id, list_id: list.id }),
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

  it("task_create tags find-or-create and attach", async () => {
    const sid = "sess-task-create-tags";
    await testConv().initConversation(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: TEST_SAP_CHAT_PLATFORM,
    });

    const worldId = testAgentWorldId();
    let output = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("task_create")!;
        output = await Promise.resolve(
          tool.handler({
            subject_kind: "agent",
            title: "Tagged by name",
            tags: ["bug"],
          }),
        );
      },
      { tools: toolSets },
    );

    const parsed = JSON.parse(output) as {
      ok: boolean;
      item: { tag_ids: number[] };
    };
    expect(parsed.ok).toBe(true);
    expect(parsed.item.tag_ids).toHaveLength(1);
    const tags = await listTags(worldId);
    const bug = tags.find((t) => t.title.toLowerCase() === "bug");
    expect(bug).toBeDefined();
    expect(parsed.item.tag_ids).toEqual([bug!.id]);
  });

  it("task_create tags reuses existing title case-insensitively", async () => {
    const sid = "sess-task-create-tags-ci";
    await testConv().initConversation(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: TEST_SAP_CHAT_PLATFORM,
    });

    const worldId = testAgentWorldId();
    const tagTitle = `Bug-${randomUUID().slice(0, 8)}`;
    const existing = await createTag(worldId, { title: tagTitle });
    const before = (await listTags(worldId)).length;

    let output = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("task_create")!;
        output = await Promise.resolve(
          tool.handler({
            subject_kind: "agent",
            title: "Reuse tag",
            tags: [tagTitle.toLowerCase()],
          }),
        );
      },
      { tools: toolSets },
    );

    const parsed = JSON.parse(output) as {
      ok: boolean;
      item: { tag_ids: number[] };
    };
    expect(parsed.ok).toBe(true);
    expect(parsed.item.tag_ids).toEqual([existing.id]);
    expect((await listTags(worldId)).length).toBe(before);
  });

  it("task_create merges tags and tag_ids", async () => {
    const sid = "sess-task-create-tags-merge";
    await testConv().initConversation(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: TEST_SAP_CHAT_PLATFORM,
    });

    const worldId = testAgentWorldId();
    const workTitle = `work-${randomUUID().slice(0, 8)}`;
    const bugTitle = `bug-${randomUUID().slice(0, 8)}`;
    const work = await createTag(worldId, { title: workTitle });

    let output = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("task_create")!;
        output = await Promise.resolve(
          tool.handler({
            subject_kind: "agent",
            title: "Merged tags",
            tag_ids: [work.id],
            tags: [bugTitle],
          }),
        );
      },
      { tools: toolSets },
    );

    const parsed = JSON.parse(output) as {
      ok: boolean;
      item: { tag_ids: number[] };
    };
    expect(parsed.ok).toBe(true);
    expect(parsed.item.tag_ids).toContain(work.id);
    expect(parsed.item.tag_ids).toHaveLength(2);
  });

  it("task_create rejects non-integer tag_ids elements", async () => {
    const sid = "sess-task-create-bad-tag-ids";
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
            subject_kind: "agent",
            title: "Bad tag_ids",
            tag_ids: ["bug"],
          }),
        );
      },
      { tools: toolSets },
    );

    const parsed = JSON.parse(output) as { error?: string };
    expect(parsed.error).toContain("invalid tag_ids");
  });
});
