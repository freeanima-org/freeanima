import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { createAcpTaskQueryPort } from "./acp-task-query.ts";

const getMessageContentByIdMock = mock(async () => "progress");
const listRecentMessagesMock = mock(async () => [
  {
    role: "assistant",
    content:
      '[ACP result]\n{"kind":"result","task_id":"t9","acp_conversation_id":"acp-9","output":"done","mode":"agent"}',
  },
]);

mock.module("@freeanima/host/core/db/pg/conversation", () => ({
  getMessageContentById: getMessageContentByIdMock,
  listRecentMessages: listRecentMessagesMock,
}));

describe("createAcpTaskQueryPort", () => {
  beforeEach(() => {
    getMessageContentByIdMock.mockClear();
    listRecentMessagesMock.mockClear();
  });

  afterEach(() => {
    getMessageContentByIdMock.mockClear();
    listRecentMessagesMock.mockClear();
  });

  it("finds ACP result message by task_id", async () => {
    const port = createAcpTaskQueryPort();
    const result = await port.findAcpResultForTask("sess-1", "t9");
    expect(result?.output).toBe("done");
    expect(result?.conversation_id).toBe("acp-9");
  });
});
