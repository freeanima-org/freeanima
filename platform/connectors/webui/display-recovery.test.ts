import { describe, expect, it } from "bun:test";
import type { DisplayItem } from "./api/index.ts";
import {
  hasNewAssistantReply,
  pollUntilAssistantReply,
  RECOVERY_INITIAL_DELAY_MS,
} from "./display-recovery.ts";

describe("hasNewAssistantReply", () => {
  const baseline = 1;
  const userOnly: DisplayItem[] = [{ type: "message", role: "user", content: "hi" }];

  it("tool_block alone does not count as reply", () => {
    const display: DisplayItem[] = [
      ...userOnly,
      {
        type: "tool_block",
        calls: [
          {
            name: "file_read_file",
            argsPreview: "path=a.ts",
            tool_call_id: "tc1",
            status: "done",
          },
        ],
      },
    ];
    expect(hasNewAssistantReply(display, baseline)).toBe(false);
  });

  it("assistant message after baseline counts as reply", () => {
    const display: DisplayItem[] = [
      ...userOnly,
      { type: "message", role: "assistant", content: "done" },
    ];
    expect(hasNewAssistantReply(display, baseline)).toBe(true);
  });

  it("tool_block plus assistant counts as reply", () => {
    const display: DisplayItem[] = [
      ...userOnly,
      {
        type: "tool_block",
        calls: [
          {
            name: "file_read_file",
            argsPreview: "path=a.ts",
            tool_call_id: "tc1",
            status: "done",
          },
        ],
      },
      { type: "message", role: "assistant", content: "result" },
    ];
    expect(hasNewAssistantReply(display, baseline)).toBe(true);
  });
});

describe("pollUntilAssistantReply", () => {
  it("returns true when recoverDisplay succeeds on later attempt", async () => {
    let calls = 0;
    const ok = await pollUntilAssistantReply(
      "sid",
      async () => {
        calls++;
        return calls >= 2;
      },
      { maxDurationMs: RECOVERY_INITIAL_DELAY_MS * 4 },
    );
    expect(ok).toBe(true);
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it("returns false when deadline passes without assistant", async () => {
    const ok = await pollUntilAssistantReply("sid", async () => false, { maxDurationMs: 50 });
    expect(ok).toBe(false);
  });
});
