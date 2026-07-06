import { describe, it, expect } from "bun:test";
import { mergeProgressFragments, formatProgressBody, type AcpAsyncTask } from "./async-task.ts";

describe("mergeProgressFragments", () => {
  it("merges text chunks and dedupes tool hints", () => {
    const merged = mergeProgressFragments([
      "hello ",
      "world",
      "🔧 read_file(...)",
      "🔧 read_file(...)",
      "done",
    ]);
    expect(merged).toContain("helloworld");
    expect(merged).toContain("🔧 read_file(...)");
    expect(merged.split("🔧 read_file(...)").length).toBe(2);
    expect(merged).toContain("done");
  });
});

describe("formatProgressBody", () => {
  it("merges notes into a single progress block", () => {
    const task: AcpAsyncTask = {
      taskId: "abc",
      agentName: "cursor",
      acpSessionId: "s1",
      animaSessionId: "n1",
      mode: "agent",
      status: "running",
      startedAt: Date.now() - 5000,
      lastProgressAt: Date.now(),
      progressNotes: ["hel", "lo", "🔧 read_file(...)"],
      lastDeliveredAt: 0,
      timeoutAt: Date.now() + 60_000,
    };
    const body = formatProgressBody(task);
    expect(body).toContain("task: abc");
    expect(body).toContain("hello");
    expect(body).toContain("🔧 read_file(...)");
  });
});
