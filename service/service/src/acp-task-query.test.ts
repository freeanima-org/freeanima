import { describe, it, expect } from "bun:test";
import { createAcpTaskQueryPort } from "./acp-task-query.ts";

describe("createAcpTaskQueryPort", () => {
  it("finds ACP result message by task_id", async () => {
    const conversation = {
      repos: {
        session: {
          getMessageContentById: async () => "progress",
          listMessages: async () => [
            {
              role: "assistant",
              content:
                '[ACP result]\n{"kind":"result","task_id":"t9","acp_session_id":"acp-9","output":"done","mode":"agent"}',
            },
          ],
        },
      },
    };

    const port = createAcpTaskQueryPort(conversation as never);
    const result = await port.findAcpResultForTask("sess-1", "t9");
    expect(result?.output).toBe("done");
    expect(result?.session_id).toBe("acp-9");
  });
});
