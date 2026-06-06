import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { runWithToolContext } from "@freeanima/engine-loop";
import { getTool } from "@freeanima/engine-tool";
import { getProfileHopModel, loadConfig } from "@freeanima/service-config";
import { addTodo, listTodos } from "@freeanima/engine-conversation/session-todos";
import { registerAllTools } from "@freeanima/service";
import { testConv } from "../../helpers/pg-test.ts";

describePg("session todo", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("anima-todo-");
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });

  it("two sessions isolated in session_meta.todos", async () => {
    const cfg = loadConfig();
    const model = getProfileHopModel(cfg);
    const repos = testConv().repos;

    await testConv().initSession("sess-a", model, { platform: "test" });
    await testConv().initSession("sess-b", model, { platform: "test" });

    await runWithToolContext(
      "sess-a",
      async () => {
        await addTodo(repos, "sess-a", "任务 A");
      },
      { repos },
    );
    await runWithToolContext(
      "sess-b",
      async () => {
        await addTodo(repos, "sess-b", "任务 B");
      },
      { repos },
    );

    expect(await listTodos(repos, "sess-a")).toContain("任务 A");
    expect(await listTodos(repos, "sess-a")).not.toContain("任务 B");
    expect(await listTodos(repos, "sess-b")).toContain("任务 B");

    const metaA = await testConv().loadSessionMeta("sess-a");
    expect(metaA.role).toBe("session_meta");
    if (metaA.role !== "session_meta") return;
    const todos = metaA.todos as { items?: { content?: string }[] } | undefined;
    expect(todos?.items?.[0]?.content).toBe("任务 A");
  });

  it("todo handler sees session when invoked inside bound runStream iteration", async () => {
    registerAllTools();

    const cfg = loadConfig();
    const sid = "sess-todo-stream";
    const repos = testConv().repos;
    await testConv().initSession(sid, getProfileHopModel(cfg), { platform: "parlor" });

    async function* fakeStream() {
      const tool = getTool("todo")!;
      const result = await Promise.resolve(tool.handler({ action: "add", content: "stream 测试" }));
      yield result;
    }

    let output = "";
    for await (const chunk of runWithToolContext(sid, () => fakeStream(), { repos })) {
      output = String(chunk);
    }

    expect(output).toContain("已添加");
    expect(output).not.toContain("无 session 上下文");
  });
});
