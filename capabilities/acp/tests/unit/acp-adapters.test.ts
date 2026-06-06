import { describe, it, expect } from "bun:test";
import { parseSessionUpdateChunk } from "../../src/adapters/generic.ts";
import { cursorAcpAdapter } from "../../src/adapters/cursor.ts";
import { resolveAcpAdapter } from "../../src/adapters/registry.ts";
import { createPromptCapture, parseCursorQuestions } from "../../src/cursor-decision.ts";

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

  it("create_plan 返回 rejected 并捕获方案", () => {
    const capture = createPromptCapture();
    const r = cursorAcpAdapter.handleServerRequest(
      "cursor/create_plan",
      { plan: "step 1\nstep 2" },
      { client: {} as never, capture },
    );
    expect(r).toEqual({ outcome: { outcome: "rejected", reason: "anima:awaiting_review" } });
    expect(capture.pending).toHaveLength(1);
    expect(capture.pending[0]?.kind).toBe("plan");
  });

  it("ask_question 不盲选，返回 skipped 并捕获问题", () => {
    const capture = createPromptCapture();
    const r = cursorAcpAdapter.handleServerRequest(
      "cursor/ask_question",
      {
        questions: [
          {
            id: "q1",
            prompt: "Pick one",
            options: [
              { id: "a", label: "A" },
              { id: "b", label: "B" },
            ],
          },
        ],
      },
      { client: {} as never, capture },
    );
    expect(r?.outcome).toEqual({ outcome: "skipped", reason: "anima:awaiting_decision" });
    expect(capture.pending[0]?.kind).toBe("questions");
    if (capture.pending[0]?.kind === "questions") {
      expect(capture.pending[0].questions[0]?.options).toHaveLength(2);
    }
  });
});

describe("parseCursorQuestions", () => {
  it("解析问题结构", () => {
    const qs = parseCursorQuestions({
      questions: [{ id: "1", prompt: "Hello?", options: [{ id: "x", label: "Yes" }] }],
    });
    expect(qs[0]?.prompt).toBe("Hello?");
    expect(qs[0]?.options[0]?.id).toBe("x");
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
