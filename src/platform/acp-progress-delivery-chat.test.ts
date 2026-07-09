import { describe, it, expect, mock } from "bun:test";
import type { AcpAsyncTaskSnapshot } from "@freeanima/capabilities/acp";

const updates: Array<{ messageId: string; content: string }> = [];
let storedId = "";
let storedContent = "";

const appendMessageReturningIdMock = mock(async (_sid: string, msg: { content: string }) => {
  storedContent = msg.content;
  storedId = "msg-progress-1";
  return { messageId: storedId };
});

const updateMessageContentMock = mock(async (_sid: string, messageId: string, content: string) => {
  updates.push({ messageId, content });
  storedContent = content;
});

mock.module("@freeanima/core/db/pg/conversation", () => ({
  appendMessageReturningId: appendMessageReturningIdMock,
  updateMessageContent: updateMessageContentMock,
}));

import { createAcpProgressDelivery } from "./acp-progress-delivery.ts";

describe("createAcpProgressDelivery chat progress", () => {
  it("append then update progress message in place", async () => {
    updates.length = 0;
    storedId = "";
    storedContent = "";
    appendMessageReturningIdMock.mockClear();
    updateMessageContentMock.mockClear();

    const conversation = {
      loadConversationMeta: async () => ({
        role: "conversation_meta" as const,
        model: "test",
        cached_toolsets: [],
        functions: [],
        timestamp: "",
        platform: "chat",
      }),
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

    const first = await port.deliverProgress(task, "progress v1");
    expect(first?.progressMessageId).toBe("msg-progress-1");
    expect(storedContent).toBe("progress v1");

    const second = await port.deliverProgress(
      {
        ...task,
        ...(first?.progressMessageId ? { progressMessageId: first.progressMessageId } : {}),
      },
      "progress v2",
    );
    expect(second?.progressMessageId).toBe("msg-progress-1");
    expect(updates).toHaveLength(1);
    expect(storedContent).toBe("progress v2");
  });
});
