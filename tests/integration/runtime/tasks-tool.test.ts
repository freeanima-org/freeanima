import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { runWithToolContext } from "@freeanima/engine-loop";
import { ToolRegistry } from "@freeanima/engine-tool";
import { getProfileHopModel, loadConfig } from "@freeanima/service-config";
import {
  registerTaskTools,
  registerTasksModule,
  resetTasksModuleForTests,
} from "@freeanima/capabilities-tasks";
import { registerTaskStore, resetTaskStoreForTests } from "@freeanima/capabilities-tasks/task-port";
import { testConv } from "../../helpers/pg-test.ts";

const tools = new ToolRegistry();

describePg("tasks tool", () => {
  const prev = process.env.FREEANIMA_HOME;
  const summaryWrites: { module: string; id: string; value: string }[] = [];

  beforeEach(async () => {
    await beginIntegrationCase("anima-tasks-");
    summaryWrites.length = 0;
    resetTaskStoreForTests();
    resetTasksModuleForTests();
    registerTaskStore(testConv().repos.tasks);
    registerTasksModule({
      fridgeBridge: {
        setMagnet: async (module: string, id: string, value: string) => {
          summaryWrites.push({ module, id, value });
        },
      },
    });
    registerTaskTools(tools);
  });

  afterEach(async () => {
    resetTaskStoreForTests();
    resetTasksModuleForTests();
    await restoreIntegrationHome(prev);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });

  it("create_task 写入 PG 并同步冰箱贴摘要", async () => {
    const cfg = loadConfig();
    const sid = "sess-task-create";
    const repos = testConv().repos;
    await testConv().initSession(sid, getProfileHopModel(cfg), { platform: "parlor" });

    let output = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = tools.get("create_task")!;
        output = await Promise.resolve(
          tool.handler({
            title: "找天空聊UI",
            priority: "high",
          }),
        );
      },
      { repos, tools },
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
    expect(parsed.task.title).toBe("找天空聊UI");
    expect(parsed.task.status).toBe("pending");
    expect(parsed.task.priority).toBe("high");
    expect(parsed.task.source_session_id).toBe(sid);

    const row = await repos.tasks.get(parsed.task.id);
    expect(row?.title).toBe("找天空聊UI");

    expect(summaryWrites.some((w) => w.module === "tasks" && w.id === "summary")).toBe(true);
    expect(summaryWrites.at(-1)?.value).toContain("待办 (1)");
    expect(summaryWrites.at(-1)?.value).toContain("找天空聊UI");
  });

  it("list_tasks 默认仅 pending + in_progress", async () => {
    const cfg = loadConfig();
    const sid = "sess-task-list";
    const repos = testConv().repos;
    await testConv().initSession(sid, getProfileHopModel(cfg), { platform: "parlor" });

    const created = await repos.tasks.create({
      title: "活跃任务",
      source_session_id: sid,
    });
    await repos.tasks.update({
      id: created.id,
      status: "completed",
      completed_at: new Date().toISOString(),
    });
    await repos.tasks.create({ title: "待办任务", source_session_id: sid });

    let output = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = tools.get("list_tasks")!;
        output = await Promise.resolve(tool.handler({}));
      },
      { repos, tools },
    );

    const parsed = JSON.parse(output) as {
      ok: boolean;
      count: number;
      tasks: { title: string }[];
    };
    expect(parsed.count).toBe(1);
    expect(parsed.tasks[0]?.title).toBe("待办任务");
  });

  it("complete_task 更新状态", async () => {
    const cfg = loadConfig();
    const sid = "sess-task-complete";
    const repos = testConv().repos;
    await testConv().initSession(sid, getProfileHopModel(cfg), { platform: "parlor" });

    const created = await repos.tasks.create({
      title: "要完成的任务",
      source_session_id: sid,
    });

    let output = "";
    await runWithToolContext(
      sid,
      async () => {
        const tool = tools.get("complete_task")!;
        output = await Promise.resolve(tool.handler({ id: created.id }));
      },
      { repos, tools },
    );

    const parsed = JSON.parse(output) as {
      ok: boolean;
      task: { status: string; completed_at: string | null };
    };
    expect(parsed.task.status).toBe("completed");
    expect(parsed.task.completed_at).not.toBeNull();
    expect(summaryWrites.at(-1)?.value).toBe("待办 (0)");
  });
});
