import { describe, expect, it } from "bun:test";
import type { DisplayItem } from "@/lib/types.ts";
import { displayAwaitingReply, hasNewAssistantReply } from "./display-recovery.ts";

describe("displayAwaitingReply", () => {
  it("returns false for empty display", () => {
    expect(displayAwaitingReply([])).toBe(false);
  });

  it("returns true when last item is user message", () => {
    expect(displayAwaitingReply([{ type: "message", role: "user", content: "hi" }])).toBe(true);
  });

  it("returns false when assistant already replied", () => {
    expect(
      displayAwaitingReply([
        { type: "message", role: "user", content: "hi" },
        { type: "message", role: "assistant", content: "hello" },
      ]),
    ).toBe(false);
  });
});

describe("hasNewAssistantReply", () => {
  it("detects assistant in new tail", () => {
    const display: DisplayItem[] = [
      { type: "message", role: "user", content: "hi" },
      { type: "message", role: "assistant", content: "ok" },
    ];
    expect(hasNewAssistantReply(display, 1)).toBe(true);
    expect(hasNewAssistantReply(display, 2)).toBe(false);
  });
});
