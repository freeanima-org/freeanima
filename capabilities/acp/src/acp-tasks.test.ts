import { describe, it, expect } from "bun:test";
import { findUnhandledAcpTasks } from "./acp-tasks.ts";

describe("findUnhandledAcpTasks", () => {
  it("returns completed and awaiting_decision newer than handledAt", () => {
    const tasks = {
      s1: {
        status: "completed" as const,
        task_id: "t1",
        agent_name: "cursor",
        updated_at: "2026-06-11T10:00:00.000Z",
      },
      s2: {
        status: "awaiting_decision" as const,
        task_id: "t2",
        agent_name: "cursor",
        updated_at: "2026-06-11T11:00:00.000Z",
        pending: [{ kind: "questions" as const, questions: [] }],
      },
      s3: {
        status: "running" as const,
        task_id: "t3",
        agent_name: "cursor",
        updated_at: "2026-06-11T12:00:00.000Z",
      },
    };
    const out = findUnhandledAcpTasks(tasks, "2026-06-11T09:00:00.000Z");
    expect(out).toHaveLength(2);
    expect(out[0]?.task_id).toBe("t1");
    expect(out[1]?.task_id).toBe("t2");
  });

  it("skips tasks already handled", () => {
    const tasks = {
      s1: {
        status: "completed" as const,
        task_id: "t1",
        agent_name: "cursor",
        updated_at: "2026-06-11T10:00:00.000Z",
      },
    };
    expect(findUnhandledAcpTasks(tasks, "2026-06-11T10:00:00.000Z")).toHaveLength(0);
  });
});
