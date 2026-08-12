import { afterEach, describe, expect, it } from "bun:test";

import {
  notifySoftFailure,
  registerSoftFailureNotify,
  unregisterSoftFailureNotify,
} from "@freeanima/host/core/soft-failure";
import { notifyPromptFoldBudgetSoftFailure } from "./prompt-fold-soft-failure-notify.ts";

afterEach(() => {
  unregisterSoftFailureNotify();
});

describe("notifyPromptFoldBudgetSoftFailure", () => {
  it("returns noop when nothing truncated or dropped", async () => {
    const action = await notifyPromptFoldBudgetSoftFailure({
      truncatedSectionIds: [],
      droppedSectionIds: [],
    });
    expect(action).toBe("noop");
  });

  it("notifies via soft-failure port when sections truncated", async () => {
    const calls: Array<{ sourceRef: string; title: string }> = [];
    registerSoftFailureNotify(async (input) => {
      calls.push({ sourceRef: input.sourceRef, title: input.title });
      return "notified";
    });

    const action = await notifyPromptFoldBudgetSoftFailure(
      {
        truncatedSectionIds: ["env-health-baseline"],
        droppedSectionIds: [],
      },
      { nowMs: Date.parse("2026-07-27T20:00:00.000Z") },
    );
    expect(action).toBe("notified");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.sourceRef).toBe("prompt:fold_budget:2026-07-28");
    expect(calls[0]?.title).toContain("System prompt");
  });
});

describe("notifySoftFailure unbound", () => {
  it("skips without registration", async () => {
    expect(
      await notifySoftFailure({
        sourceRef: "x",
        title: "t",
        body: "b",
      }),
    ).toBe("skipped");
  });
});
