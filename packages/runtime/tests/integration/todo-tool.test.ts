import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { describePg } from "../../../db/tests/helpers/pg-test-gate.ts";
import { beginIntegrationCase, endIntegrationCase } from "../../../db/tests/helpers/integration-case.ts";

import { initSession, loadSessionMeta, runWithToolContext } from "@freeanima/legacy-engine";
import { loadConfig, getTool } from "@freeanima/legacy-kernel";
import { addTodo, listTodos } from "@freeanima/legacy-runtime";
import { registerAllTools } from "@freeanima/legacy-tools";

describePg("session todo", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("anima-todo-");
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prev;
  });

  afterAll(async () => {
    await endIntegrationCase();
  });

  it("two sessions isolated in session_meta.todos", async () => {
    const cfg = loadConfig();
    const model = cfg.model ?? "test-model";

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
    expect(metaA.todos?.items[0]?.content).toBe("任务 A");
  });

  it("todo handler sees session when invoked inside bound runStream iteration", async () => {
    registerAllTools();

    const cfg = loadConfig();
    const sid = "sess-todo-stream";
    await initSession(sid, cfg.model ?? "test-model", { platform: "parlor" });

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
