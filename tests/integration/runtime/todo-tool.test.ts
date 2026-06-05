import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { initSession, loadSessionMeta, runWithToolContext } from "@freeanima/engine";
import { getTool } from "@freeanima/engine-tool";
import { getProfileHopModel, loadConfig } from "@freeanima/service-config";
import { addTodo, listTodos } from "@freeanima/legacy-runtime";
import { registerAllTools } from "@freeanima/legacy-tools";

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

    await initSession("sess-a", model, { platform: "test" });
    await initSession("sess-b", model, { platform: "test" });

    await runWithToolContext("sess-a", async () => {
      await addTodo("sess-a", "任务 A");
    });
    await runWithToolContext("sess-b", async () => {
      await addTodo("sess-b", "任务 B");
    });

    expect(await listTodos("sess-a")).toContain("任务 A");
    expect(await listTodos("sess-a")).not.toContain("任务 B");
    expect(await listTodos("sess-b")).toContain("任务 B");

    const metaA = await loadSessionMeta("sess-a");
    expect(metaA.role).toBe("session_meta");
    if (metaA.role !== "session_meta") return;
    const todos = metaA.todos as { items?: { content?: string }[] } | undefined;
    expect(todos?.items?.[0]?.content).toBe("任务 A");
  });

  it("todo handler sees session when invoked inside bound runStream iteration", async () => {
    registerAllTools();

    const cfg = loadConfig();
    const sid = "sess-todo-stream";
    await initSession(sid, getProfileHopModel(cfg), { platform: "parlor" });

    async function* fakeStream() {
      const tool = getTool("todo")!;
      const result = await Promise.resolve(tool.handler({ action: "add", content: "stream 测试" }));
      yield result;
    }

    let output = "";
    for await (const chunk of runWithToolContext(sid, () => fakeStream())) {
      output = String(chunk);
    }

    expect(output).toContain("已添加");
    expect(output).not.toContain("无 session 上下文");
  });
});
