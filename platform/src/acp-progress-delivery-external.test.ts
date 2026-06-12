import { describe, it, expect, vi } from "bun:test";
import type { AcpAsyncTaskSnapshot } from "@freeanima/capabilities-acp";

const deliverToTargets = vi.fn();

vi.mock("@freeanima/platform/connectors/cron/deliver", () => ({
  deliverToTargets: (...args: unknown[]) => deliverToTargets(...args),
  deliverCronResult: async () => {},
  registerCronDeliverer: () => {},
  unregisterCronDeliverer: () => {},
  resolveDeliverTargets: () => [],
}));

const { createAcpProgressDelivery } = await import("./acp-progress-delivery.ts");

describe("createAcpProgressDelivery external progress", () => {
  it("discord immediate: edit and return discord-prefixed id", async () => {
    deliverToTargets.mockReset();
    deliverToTargets.mockResolvedValueOnce({ messageId: "1234567890" });

    const conversation = {
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

    const task: AcpAsyncTaskSnapshot = {
      taskId: "t1",
      agentName: "cursor",
      acpSessionId: "acp-1",
      animaSessionId: "sess-1",
      mode: "agent",
      status: "running",
      startedAt: Date.now(),
    };

    const res = await port.deliverProgress(task, "progress body", { weixinBatch: false });
    expect(res?.progressMessageId).toBe("discord:1234567890");
    expect(deliverToTargets).toHaveBeenCalledWith(
      [{ platform: "discord", chat_id: "ch-1" }],
      "progress body",
      { editMessageId: undefined },
    );
  });

  it("weixin skipped on debounced immediate deliver", async () => {
    deliverToTargets.mockReset();

    const conversation = {
      loadSessionMeta: async () => ({
        role: "session_meta" as const,
        model: "test",
        tools: [],
        functions: [],
        timestamp: "",
        platform: "weixin",
        platform_extra: { chat_id: "wx-1" },
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
      animaSessionId: "sess-1",
      mode: "agent",
      status: "running",
      startedAt: Date.now(),
    };

    await port.deliverProgress(task, "batch body", { weixinBatch: false });
    expect(deliverToTargets).not.toHaveBeenCalled();
  });

  it("weixin batch ticker delivers new message", async () => {
    deliverToTargets.mockReset();
    deliverToTargets.mockResolvedValueOnce(undefined);

    const conversation = {
      loadSessionMeta: async () => ({
        role: "session_meta" as const,
        model: "test",
        tools: [],
        functions: [],
        timestamp: "",
        platform: "weixin",
        platform_extra: { chat_id: "wx-1" },
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
      animaSessionId: "sess-1",
      mode: "agent",
      status: "running",
      startedAt: Date.now(),
    };

    await port.deliverProgress(task, "batch body", { weixinBatch: true });
    expect(deliverToTargets).toHaveBeenCalledWith(
      [{ platform: "weixin", chat_id: "wx-1" }],
      "batch body",
      { editMessageId: undefined },
    );
  });
});
