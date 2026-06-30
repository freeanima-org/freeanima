import { describe, it, expect } from "bun:test";
import { AcpClientPool } from "./client-pool.ts";
import { AcpTaskScheduler, type AsyncLaunchSpec } from "./task-scheduler.ts";
import type { ACPClient } from "./client.ts";

function mockClient(): ACPClient {
  return {
    abortActivePrompt: () => {},
    stop: () => {},
    isConnected: true,
    isProcessAlive: () => true,
  } as unknown as ACPClient;
}

function spec(id: string): AsyncLaunchSpec {
  const now = Date.now();
  return {
    taskId: id,
    agentName: "cursor",
    prompt: "p",
    context: "",
    animaSessionId: "sess",
    timeoutMinutes: 30,
    enqueuedAt: now,
    deadlineAt: now + 60_000,
    wasQueued: false,
  };
}

describe("AcpTaskScheduler", () => {
  it("queues when pool is full and starts next on terminal", async () => {
    const pool = new AcpClientPool(1, async () => mockClient());
    const started: string[] = [];
    let resolveFirst!: () => void;
    const firstDone = new Promise<void>((r) => {
      resolveFirst = r;
    });

    const scheduler = new AcpTaskScheduler(pool, 1, {
      onStart: async (s) => {
        started.push(s.taskId);
        if (s.taskId === "t1") await firstDone;
      },
      onQueueTimeout: async () => {},
    });

    expect(scheduler.enqueue(spec("t1")).status).toBe("started");
    const q = scheduler.enqueue(spec("t2"));
    expect(q.status).toBe("queued");
    expect(q.queuePosition).toBe(1);

    await new Promise((r) => {
      setTimeout(r, 10);
    });
    expect(started).toEqual(["t1"]);

    resolveFirst();
    await new Promise((r) => {
      setTimeout(r, 20);
    });
    scheduler.onTaskTerminal("t1");

    await new Promise((r) => {
      setTimeout(r, 30);
    });
    expect(started).toEqual(["t1", "t2"]);
  });

  it("cancelQueued removes pending task", () => {
    const pool = new AcpClientPool(1, async () => mockClient());
    const scheduler = new AcpTaskScheduler(pool, 1, {
      onStart: async () => {},
      onQueueTimeout: async () => {},
    });
    scheduler.enqueue(spec("t1"));
    scheduler.enqueue(spec("t2"));
    expect(scheduler.cancelQueued("t2")).toBe(true);
    expect(scheduler.getQueuePosition("t2")).toBeUndefined();
  });
});
