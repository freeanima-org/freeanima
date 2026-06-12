import { describe, it, expect } from "bun:test";
import { AcpClientPool } from "../../../capabilities/acp/src/client-pool.ts";
import { AcpTaskScheduler } from "../../../capabilities/acp/src/task-scheduler.ts";
import type { ACPClient } from "../../../capabilities/acp/src/client.ts";

function mockClient(): ACPClient {
  return {
    abortActivePrompt: () => {},
    stop: () => {},
    isConnected: true,
    isProcessAlive: () => true,
  } as unknown as ACPClient;
}

describe("ACP parallel scheduler", () => {
  it("queues third task when max concurrent is 2", () => {
    const pool = new AcpClientPool(2, async () => mockClient());
    const scheduler = new AcpTaskScheduler(pool, 2, {
      onStart: async () => {},
      onQueueTimeout: async () => {},
    });

    expect(
      scheduler.enqueue({
        taskId: "t1",
        agentName: "cursor",
        prompt: "a",
        context: "",
        animaSessionId: "s",
        timeoutMinutes: 30,
        enqueuedAt: Date.now(),
        deadlineAt: Date.now() + 60_000,
        wasQueued: false,
      }).status,
    ).toBe("started");

    expect(
      scheduler.enqueue({
        taskId: "t2",
        agentName: "cursor",
        prompt: "b",
        context: "",
        animaSessionId: "s",
        timeoutMinutes: 30,
        enqueuedAt: Date.now(),
        deadlineAt: Date.now() + 60_000,
        wasQueued: false,
      }).status,
    ).toBe("started");

    const third = scheduler.enqueue({
      taskId: "t3",
      agentName: "cursor",
      prompt: "c",
      context: "",
      animaSessionId: "s",
      timeoutMinutes: 30,
      enqueuedAt: Date.now(),
      deadlineAt: Date.now() + 60_000,
      wasQueued: false,
    });
    expect(third.status).toBe("queued");
    expect(third.queuePosition).toBe(1);
  });
});
