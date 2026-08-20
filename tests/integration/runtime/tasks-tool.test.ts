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
import { createProject } from "@freeanima/features/project/domain";
import { createTag, listTags } from "@freeanima/features/tag/domain";
import { getActivePgTestContext, testConv } from "../../helpers/pg-test.ts";
import { TEST_SAP_CHAT_PLATFORM } from "../../helpers/remote-tools-chat-test-platform.ts";
import { testAgentWorldId } from "../../helpers/world-context.ts";
import { getResolvedWorldContext } from "@freeanima/habitat/core/config/world-context";

function testCfg() {
  const ctx = getActivePgTestContext();
  if (!ctx) throw new Error("PG test context not initialized");
  return ctx.config.data;
}

describePg("tasks tool (enhanced)", () => {
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
          authorization: { full: true as const },
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

  afterAll(async () => {
    await endIntegrationCase();
  });
});
