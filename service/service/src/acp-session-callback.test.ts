import { describe, it, expect } from "bun:test";
import { buildAcpCallbackPrompt } from "./acp-session-callback.ts";

describe("buildAcpCallbackPrompt", () => {
  it("lists unhandled tasks", () => {
    const prompt = buildAcpCallbackPrompt([
      {
        acp_session_id: "s1",
        status: "completed",
        task_id: "t1",
        agent_name: "cursor",
        updated_at: "2026-06-11T10:00:00.000Z",
      },
      {
        acp_session_id: "s2",
        status: "awaiting_decision",
        task_id: "t2",
        agent_name: "cursor",
        updated_at: "2026-06-11T11:00:00.000Z",
      },
    ]);
    expect(prompt).toContain("[ACP result]");
    expect(prompt).toContain("立即处理");
    expect(prompt).toContain("t1");
    expect(prompt).toContain("t2");
    expect(prompt).toContain("continue_session=true");
  });
});
