import { describe, it, expect } from "bun:test";
import {
  AcpAsyncTaskStore,
  appendProgressNote,
  formatElapsed,
  formatProgressBody,
} from "./async-task.ts";

describe("AcpAsyncTaskStore", () => {
  it("findActive finds running task by agent", () => {
    const store = new AcpAsyncTaskStore();
    const now = Date.now();
    store.set({
      taskId: "a1",
      agentName: "cursor",
      acpSessionId: "s1",
      animaSessionId: "n1",
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
      animaSessionId: "n2",
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
    expect(store.countRunning("cursor")).toBe(1);
    expect(store.listQueued()).toHaveLength(0);
  });

  it("listQueued returns queued tasks", () => {
    const store = new AcpAsyncTaskStore();
    const now = Date.now();
    store.set({
      taskId: "q1",
      agentName: "cursor",
      acpSessionId: "",
      animaSessionId: "n1",
      mode: "agent",
      status: "queued",
      startedAt: now,
      lastProgressAt: now,
      progressNotes: [],
      lastDeliveredAt: 0,
      timeoutAt: now + 60_000,
      queuePosition: 2,
    });
    expect(store.listQueued("cursor")).toHaveLength(1);
  });
});

describe("formatProgressBody", () => {
  it("includes recent progress snippet", () => {
    const now = Date.now();
    const body = formatProgressBody({
      taskId: "abc123",
      agentName: "cursor",
      acpSessionId: "s1",
      animaSessionId: "n1",
      mode: "agent",
      status: "running",
      startedAt: now - 90_000,
      lastProgressAt: now,
      progressNotes: ["Analyzing code", "Implementing plan"],
      lastDeliveredAt: 0,
      timeoutAt: now + 60_000,
    });
    expect(body).toContain("task: abc123");
    expect(body).toContain("1m30s");
    expect(body).toContain("Analyzing code");
  });
});

describe("appendProgressNote", () => {
  it("updates lastProgressAt and limits count", () => {
    const now = Date.now();
    const task = {
      taskId: "t1",
      agentName: "cursor",
      acpSessionId: "s1",
      animaSessionId: "n1",
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
  it("formats minutes and seconds", () => {
    expect(formatElapsed(45_000)).toBe("45s");
    expect(formatElapsed(125_000)).toBe("2m5s");
  });
});
