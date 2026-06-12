import { describe, it, expect, vi } from "bun:test";
import type { AcpAsyncTaskSnapshot, AcpPromptResult } from "@freeanima/capabilities-acp";

const deliverToTargets = vi.fn();

vi.mock("@freeanima/connectors-cron/deliver", () => ({
  deliverToTargets: (...args: unknown[]) => deliverToTargets(...args),
  deliverCronResult: async () => {},
  registerCronDeliverer: () => {},
  unregisterCronDeliverer: () => {},
  resolveDeliverTargets: () => [],
}));

const { createAcpProgressDelivery } = await import("./acp-progress-delivery.ts");

describe("createAcpProgressDelivery deliverResult", () => {
  it("discord: writes [ACP result] to conversation then delivers externally", async () => {
    deliverToTargets.mockReset();
    deliverToTargets.mockResolvedValueOnce(undefined);

    const appended: Array<{ session: string; content: string }> = [];
    const sessionUpdated: string[] = [];

    const conversation = {
      appendMessage: async (msg: { role: string; content: string }, session: string) => {
        appended.push({ session, content: msg.content });
      },
      loadSessionMeta: async () => ({
        role: "session_meta" as const,
        model: "test",
        tools: [],
        functions: [],
        timestamp: "",
        platform: "discord",
        platform_extra: { channel_id: "ch-1", thread_id: "th-1" },
      }),
      repos: { session: {} },
    };

    const port = createAcpProgressDelivery({
      conversation: conversation as never,
      bus: null,
      onSessionUpdated: (sid) => sessionUpdated.push(sid),
    });

    const task: AcpAsyncTaskSnapshot = {
      taskId: "task-42",
      agentName: "cursor",
      acpSessionId: "acp-1",
      animaSessionId: "sess-discord",
      mode: "agent",
      status: "completed",
      startedAt: Date.now(),
    };

    const result: AcpPromptResult = {
      session_id: "acp-1",
      output: "full cursor output here",
      new_session: false,
      reused_binding: true,
      explicit_session: false,
      mode: "agent",
    };

    await port.deliverResult(task, result);

    expect(appended).toHaveLength(1);
    expect(appended[0]!.session).toBe("sess-discord");
    expect(appended[0]!.content).toContain("[ACP result]");
    expect(appended[0]!.content).toContain("full cursor output here");
    expect(appended[0]!.content).toContain("task-42");

    expect(deliverToTargets).toHaveBeenCalledWith(
      [{ platform: "discord", chat_id: "ch-1", thread_id: "th-1" }],
      expect.stringContaining("full cursor output here"),
    );
    expect(sessionUpdated).toEqual(["sess-discord"]);
  });

  it("parlor: writes [ACP result] without external deliver", async () => {
    deliverToTargets.mockReset();

    const appended: string[] = [];

    const conversation = {
      appendMessage: async (msg: { content: string }) => {
        appended.push(msg.content);
      },
      loadSessionMeta: async () => ({
        role: "session_meta" as const,
        model: "test",
        tools: [],
        functions: [],
        timestamp: "",
        platform: "parlor",
      }),
      repos: { session: {} },
    };

    const port = createAcpProgressDelivery({
      conversation: conversation as never,
      bus: null,
    });

    const task: AcpAsyncTaskSnapshot = {
      taskId: "t1",
      agentName: "cursor",
      acpSessionId: "acp-1",
      animaSessionId: "sess-parlor",
      mode: "agent",
      status: "completed",
      startedAt: Date.now(),
    };

    await port.deliverResult(task, {
      session_id: "acp-1",
      output: "done",
      new_session: true,
      reused_binding: false,
      explicit_session: false,
      mode: "agent",
    });

    expect(appended[0]).toContain("[ACP result]");
    expect(appended[0]).toContain("done");
    expect(deliverToTargets).not.toHaveBeenCalled();
  });

  it("deliverError writes [ACP error] to conversation", async () => {
    deliverToTargets.mockReset();

    const appended: string[] = [];

    const conversation = {
      appendMessage: async (msg: { content: string }) => {
        appended.push(msg.content);
      },
      loadSessionMeta: async () => ({
        role: "session_meta" as const,
        model: "test",
        tools: [],
        functions: [],
        timestamp: "",
        platform: "discord",
        platform_extra: { channel_id: "ch-1" },
      }),
      repos: { session: {} },
    };

    const port = createAcpProgressDelivery({
      conversation: conversation as never,
      bus: null,
    });

    await port.deliverError(
      {
        taskId: "t-err",
        agentName: "cursor",
        acpSessionId: "acp-1",
        animaSessionId: "sess-1",
        mode: "agent",
        status: "error",
        startedAt: Date.now(),
      },
      "boom",
    );

    expect(appended[0]).toContain("[ACP error]");
    expect(appended[0]).toContain("boom");
  });
});
