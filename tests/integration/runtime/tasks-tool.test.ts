import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { runWithToolContext } from "@freeanima/runtime/loop";
import { ToolSetRegistry } from "@freeanima/mechanism-tool";
import { getProfileHopModel } from "@freeanima/service-config";
import {
  registerTaskTools,
  registerTasksModule,
  resetTasksModuleForTests,
} from "@freeanima/capabilities-tasks";
import { resetTaskStoreForTests } from "@freeanima/capabilities-tasks/task-port";
import { getActivePgTestContext, testConv } from "../../helpers/pg-test.ts";

function testCfg() {
  const ctx = getActivePgTestContext();
  if (!ctx) throw new Error("PG test context not initialized");
  return ctx.config.data;
}

describePg("tasks tool", () => {
  const prev = process.env.FREEANIMA_HOME;
  const summaryWrites: { module: string; id: string; value: string }[] = [];
  const summaryDeletes: { module: string; id: string }[] = [];
  let toolSets: ToolSetRegistry;

  beforeEach(async () => {
    toolSets = new ToolSetRegistry();
    await beginIntegrationCase("anima-tasks-");
    summaryWrites.length = 0;
    summaryDeletes.length = 0;
    resetTaskStoreForTests();
    resetTasksModuleForTests();
    registerTasksModule({
      taskStore: testConv().repos.tasks,
      fridgeBridge: {
        setMagnet: async (module: string, id: string, value: string) => {
          summaryWrites.push({ module, id, value });
        },
        deleteMagnet: async (module: string, id: string) => {
          summaryDeletes.push({ module, id });
        },
      },
    });
    registerTaskTools(toolSets);
  });

  afterEach(async () => {
    resetTaskStoreForTests();
    resetTasksModuleForTests();
    await restoreIntegrationHome(prev);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });

  it("create_task writes to PG and syncs fridge summary", async () => {
    const sid = "sess-task-create";
    const repos = testConv().repos;
    await testConv().initSession(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: "parlor",
    });

    let output = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("tasks_create")!;
        output = await Promise.resolve(
          tool.handler({
            title: "Discuss UI plan",
            priority: "high",
          }),
        );
      },
      { repos, tools: toolSets },
    );

    const parsed = JSON.parse(output) as {
      ok: boolean;
      task: {
        id: string;
        title: string;
        status: string;
        priority: string;
        source_session_id: string | null;
      };
    };
    expect(parsed.ok).toBe(true);
    expect(parsed.task.title).toBe("Discuss UI plan");
    expect(parsed.task.status).toBe("pending");
    expect(parsed.task.priority).toBe("high");
    expect(parsed.task.source_session_id).toBe(sid);

    const row = await repos.tasks.get(parsed.task.id);
    expect(row?.title).toBe("Discuss UI plan");

    expect(summaryWrites.some((w) => w.module === "tasks" && w.id === "summary")).toBe(true);
    expect(summaryWrites.at(-1)?.value).toBe("1 个待办");
    expect(summaryWrites.at(-1)?.value).not.toContain("Discuss UI plan");
  });

  it("list_tasks defaults to pending + in_progress only", async () => {
    const sid = "sess-task-list";
    const repos = testConv().repos;
    await testConv().initSession(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: "parlor",
    });

    const created = await repos.tasks.create({
      title: "Active task",
      source_session_id: sid,
    });
    await repos.tasks.update({
      id: created.id,
      status: "completed",
      completed_at: new Date().toISOString(),
    });
    await repos.tasks.create({ title: "Pending task", source_session_id: sid });

    let output = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("tasks_list")!;
        output = await Promise.resolve(tool.handler({}));
      },
      { repos, tools: toolSets },
    );

    const parsed = JSON.parse(output) as {
      ok: boolean;
      count: number;
      tasks: { title: string }[];
    };
    expect(parsed.count).toBe(1);
    expect(parsed.tasks[0]?.title).toBe("Pending task");
  });

  it("tasks_complete updates status", async () => {
    const sid = "sess-task-complete";
    const repos = testConv().repos;
    await testConv().initSession(sid, getProfileHopModel(testCfg(), "chat"), {
      platform: "parlor",
    });

    const created = await repos.tasks.create({
      title: "Task to complete",
      source_session_id: sid,
    });

    let output = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = toolSets.getTool("tasks_complete")!;
        output = await Promise.resolve(tool.handler({ id: created.id }));
      },
      { repos, tools: toolSets },
    );

    const parsed = JSON.parse(output) as {
      ok: boolean;
      task: { status: string; completed_at: string | null };
    };
    expect(parsed.task.status).toBe("completed");
    expect(parsed.task.completed_at).not.toBeNull();
    expect(summaryWrites).toHaveLength(0);
    expect(summaryDeletes.at(-1)).toEqual({ module: "tasks", id: "summary" });
  });
});
