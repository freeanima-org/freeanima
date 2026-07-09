import { describe, expect, it } from "bun:test";
import {
  filterUndeliveredOutbox,
  isOutboxDeliveredOnDisplay,
  mergeOutboxStatusIntoDisplay,
  stripRedundantOptimisticDisplay,
} from "./outbox-display-sync.ts";
import type { DisplayItem } from "./types.ts";

describe("outbox-display-sync", () => {
  it("detects delivered user+assistant on server display", () => {
    const display: DisplayItem[] = [
      { type: "message", role: "user", content: "hello" },
      { type: "message", role: "assistant", content: "hi" },
    ];
    expect(isOutboxDeliveredOnDisplay(display, "hello")).toBe(true);
    expect(isOutboxDeliveredOnDisplay(display, "other")).toBe(false);
  });

  it("strips optimistic pending when server copy exists", () => {
    const display: DisplayItem[] = [
      { type: "message", role: "user", content: "hello" },
      { type: "message", role: "assistant", content: "hi" },
      {
        type: "message",
        role: "user",
        content: "hello",
        clientOpId: "op-1",
        sendStatus: "pending",
      },
    ];
    const cleaned = stripRedundantOptimisticDisplay(display);
    expect(cleaned).toHaveLength(2);
  });

  it("merges outbox status onto optimistic display items", () => {
    const display: DisplayItem[] = [
      {
        type: "message",
        role: "user",
        content: "offline msg",
        clientOpId: "op-1",
        sendStatus: "pending",
      },
    ];
    const merged = mergeOutboxStatusIntoDisplay(display, [
      {
        clientOpId: "op-1",
        conversationId: "c1",
        text: "offline msg",
        expectedTailPos: 2,
        status: "stale",
        attempts: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    expect(merged[0]?.type === "message" && merged[0].sendStatus).toBe("stale");
  });

  it("filters outbox already reflected on server", () => {
    const display: DisplayItem[] = [
      { type: "message", role: "user", content: "hello" },
      { type: "message", role: "assistant", content: "hi" },
    ];
    const remaining = filterUndeliveredOutbox(
      display,
      [
        {
          clientOpId: "op-1",
          conversationId: "c1",
          text: "hello",
          expectedTailPos: 0,
          status: "pending",
          attempts: 0,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      "c1",
    );
    expect(remaining).toHaveLength(0);
  });
});
