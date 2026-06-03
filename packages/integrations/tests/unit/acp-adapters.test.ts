import { describe, it, expect } from "bun:test";
import { parseSessionUpdateChunk } from "../../src/acp/adapters/generic";
import { cursorAcpAdapter } from "../../src/acp/adapters/cursor";
import { resolveAcpAdapter } from "../../src/acp/adapters/registry";

describe("parseSessionUpdateChunk", () => {
  it("解析 Cursor sessionUpdate 蛇形命名", () => {
    const text = parseSessionUpdateChunk({
      sessionUpdate: "agent_message_chunk",
      content: { text: "hello" },
    });
    expect(text).toBe("hello");
  });

  it("解析旧式 AgentMessageChunk", () => {
    const text = parseSessionUpdateChunk({
      type: "AgentMessageChunk",
      content: { text: "world" },
    });
    expect(text).toBe("world");
  });
});

describe("cursorAcpAdapter", () => {
  it("自动批准权限", () => {
    const r = cursorAcpAdapter.handleServerRequest("session/request_permission", {});
    expect(r).toEqual({ outcome: { outcome: "selected", optionId: "allow-once" } });
  });

  it("自动接受方案", () => {
    const r = cursorAcpAdapter.handleServerRequest("cursor/create_plan", { plan: "x" });
    expect(r).toEqual({ outcome: { outcome: "accepted" } });
  });
});

describe("resolveAcpAdapter", () => {
  it("显式 adapter", () => {
    expect(resolveAcpAdapter({ adapter: "generic" }).id).toBe("generic");
    expect(resolveAcpAdapter({ adapter: "cursor" }).id).toBe("cursor");
  });

  it("agent acp 推断 cursor", () => {
    expect(
      resolveAcpAdapter({
        command: "/usr/bin/agent",
        args: ["--force", "acp"],
      }).id,
    ).toBe("cursor");
  });
});
