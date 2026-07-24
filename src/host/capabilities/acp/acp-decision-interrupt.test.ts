import { describe, it, expect } from "bun:test";
import { cursorAcpAdapter } from "./adapters/cursor.ts";
import { createPromptCapture } from "./cursor-decision.ts";
import type { AcpDecisionNeededHandler } from "./adapters/types.ts";

describe("ACP decision interrupt", () => {
  it("ask_question invokes onDecisionNeeded with pending", async () => {
    const capture = createPromptCapture();
    const calls: Array<{ pendingLen: number; notesLen: number }> = [];
    const onDecisionNeeded: AcpDecisionNeededHandler = (pending, notes) => {
      calls.push({ pendingLen: pending.length, notesLen: notes.length });
    };

    cursorAcpAdapter.handleServerRequest(
      "cursor/ask_question",
      {
        questions: [
          {
            id: "q1",
            prompt: "Pick one",
            options: [{ id: "a", label: "A" }],
          },
        ],
      },
      { client: {} as never, capture, onDecisionNeeded },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]?.pendingLen).toBe(1);
    expect(calls[0]?.notesLen).toBeGreaterThan(0);
  });

  it("create_plan invokes onDecisionNeeded with pending", async () => {
    const capture = createPromptCapture();
    let called = false;
    cursorAcpAdapter.handleServerRequest(
      "cursor/create_plan",
      { plan: "step 1" },
      {
        client: {} as never,
        capture,
        onDecisionNeeded: () => {
          called = true;
        },
      },
    );
    expect(called).toBe(true);
  });
});
