import { describe, it, expect } from "bun:test";
import {
  AcpAsyncTaskStore,
  appendProgressNote,
  formatElapsed,
  formatProgressBody,
} from "../../src/async-task.ts";

describe("AcpAsyncTaskStore", () => {
  it("findActive 按 agent 查找运行中任务", () => {
    const store = new AcpAsyncTaskStore();
    const now = Date.now();
    store.set({
      taskId: "a1",
      agentName: "cursor",
      acpSessionId: "s1",
      nestSessionId: "n1",
      mode: "agent",
      status: "running",
      startedAt: now,
      lastProgressAt: now,
      progressNotes: [],
      lastDeliveredAt: 0,
      timeoutAt: now + 60_000,
    });
    store.set({
      taskId: "a2",
      agentName: "cursor",
      acpSessionId: "s2",
      nestSessionId: "n2",
      mode: "agent",
      status: "completed",
      startedAt: now,
      lastProgressAt: now,
      progressNotes: [],
      lastDeliveredAt: 0,
      timeoutAt: now + 60_000,
    });
    expect(store.findActive("cursor")?.taskId).toBe("a1");
    expect(store.findActive("other")).toBeUndefined();
    expect(store.listRunning()).toHaveLength(1);
  });
});

describe("formatProgressBody", () => {
  it("包含最近进度片段", () => {
    const now = Date.now();
    const body = formatProgressBody({
      taskId: "abc123",
      agentName: "cursor",
      acpSessionId: "s1",
      nestSessionId: "n1",
      mode: "agent",
      status: "running",
      startedAt: now - 90_000,
      lastProgressAt: now,
      progressNotes: ["分析代码", "实现方案"],
      lastDeliveredAt: 0,
      timeoutAt: now + 60_000,
    });
    expect(body).toContain("task: abc123");
    expect(body).toContain("1m30s");
    expect(body).toContain("分析代码");
  });
});

describe("appendProgressNote", () => {
  it("更新 lastProgressAt 并限制条数", () => {
    const now = Date.now();
    const task = {
      taskId: "t1",
      agentName: "cursor",
      acpSessionId: "s1",
      nestSessionId: "n1",
      mode: "agent" as const,
      status: "running" as const,
      startedAt: now,
      lastProgressAt: now,
      progressNotes: [] as string[],
      lastDeliveredAt: 0,
      timeoutAt: now + 60_000,
    };
    appendProgressNote(task, "  step 1 ");
    expect(task.progressNotes).toEqual(["step 1"]);
    expect(task.lastProgressAt).toBeGreaterThanOrEqual(now);
  });
});

describe("formatElapsed", () => {
  it("格式化分秒", () => {
    expect(formatElapsed(45_000)).toBe("45s");
    expect(formatElapsed(125_000)).toBe("2m5s");
  });
});
