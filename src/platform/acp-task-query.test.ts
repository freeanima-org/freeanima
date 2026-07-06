import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { createAcpTaskQueryPort } from "./acp-task-query.ts";

const getMessageContentByIdMock = mock(async () => "progress");
const listMessagesMock = mock(async () => [
  {
    role: "assistant",
    content:
      '[ACP result]\n{"kind":"result","task_id":"t9","acp_conversation_id":"acp-9","output":"done","mode":"agent"}',
  },
]);

mock.module("@freeanima/core/db/pg/conversation", () => ({
  getMessageContentById: getMessageContentByIdMock,
  listMessages: listMessagesMock,
}));

describe("createAcpTaskQueryPort", () => {
  beforeEach(() => {
    getMessageContentByIdMock.mockClear();
    listMessagesMock.mockClear();
  });

  afterEach(() => {
    getMessageContentByIdMock.mockClear();
    listMessagesMock.mockClear();
  });

  it("finds ACP result message by task_id", async () => {
    const port = createAcpTaskQueryPort();
    const result = await port.findAcpResultForTask("sess-1", "t9");
    expect(result?.output).toBe("done");
    expect(result?.conversation_id).toBe("acp-9");
  });
});
