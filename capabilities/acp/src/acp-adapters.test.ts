import { describe, it, expect } from "bun:test";
import { parseSessionUpdateChunk } from "./adapters/generic.ts";
import { cursorAcpAdapter } from "./adapters/cursor.ts";
import { resolveAcpAdapter } from "./adapters/registry.ts";
import { createPromptCapture, parseCursorQuestions } from "./cursor-decision.ts";

describe("parseSessionUpdateChunk", () => {
  it("parses Cursor sessionUpdate snake_case names", () => {
    const text = parseSessionUpdateChunk({
      sessionUpdate: "agent_message_chunk",
      content: { text: "hello" },
    });
    expect(text).toBe("hello");
  });

  it("parses legacy AgentMessageChunk", () => {
    const text = parseSessionUpdateChunk({
      type: "AgentMessageChunk",
      content: { text: "world" },
    });
    expect(text).toBe("world");
  });
});

describe("cursorAcpAdapter", () => {
  it("auto-approves permissions", () => {
    const r = cursorAcpAdapter.handleServerRequest("session/request_permission", {});
    expect(r).toEqual({ outcome: { outcome: "selected", optionId: "allow-once" } });
  });

  it("create_plan returns rejected and captures plan", () => {
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

  it("ask_question does not auto-select, returns skipped and captures questions", () => {
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
  it("parses question structure", () => {
    const qs = parseCursorQuestions({
      questions: [{ id: "1", prompt: "Hello?", options: [{ id: "x", label: "Yes" }] }],
    });
    expect(qs[0]?.prompt).toBe("Hello?");
    expect(qs[0]?.options[0]?.id).toBe("x");
  });
});

describe("resolveAcpAdapter", () => {
  it("explicit adapter", () => {
    expect(resolveAcpAdapter({ adapter: "generic" }).id).toBe("generic");
    expect(resolveAcpAdapter({ adapter: "cursor" }).id).toBe("cursor");
  });

  it("agent acp infers cursor", () => {
    expect(
      resolveAcpAdapter({
        command: "/usr/bin/agent",
        args: ["--force", "acp"],
      }).id,
    ).toBe("cursor");
  });
});
