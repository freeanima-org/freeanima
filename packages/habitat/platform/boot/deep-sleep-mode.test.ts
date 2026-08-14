import { describe, expect, it } from "bun:test";

import { resolveDeepSleepMode, shouldSkipScheduledDeepSleep } from "./deep-sleep-mode.ts";

describe("shouldSkipScheduledDeepSleep", () => {
  it("skips scheduled non-Monday", () => {
    expect(shouldSkipScheduledDeepSleep({ trigger: "scheduled", day: "2026-06-16" })).toBe(true);
  });

  it("does not skip scheduled Monday", () => {
    expect(shouldSkipScheduledDeepSleep({ trigger: "scheduled", day: "2026-06-15" })).toBe(false);
  });

  it("skips scheduled when day missing", () => {
    expect(shouldSkipScheduledDeepSleep({ trigger: "scheduled" })).toBe(true);
  });

  it("does not skip manual or catch_up", () => {
    expect(shouldSkipScheduledDeepSleep({ trigger: "manual_cycle", day: "2026-06-16" })).toBe(
      false,
    );
    expect(shouldSkipScheduledDeepSleep({ trigger: "manual_step", day: "2026-06-16" })).toBe(false);
    expect(shouldSkipScheduledDeepSleep({ trigger: "catch_up", day: "2026-06-16" })).toBe(false);
  });
});

describe("resolveDeepSleepMode", () => {
  it("honors explicit mode from context", () => {
    expect(resolveDeepSleepMode({ deep_sleep_mode: "incremental" })).toBe("incremental");
    expect(resolveDeepSleepMode({ deep_sleep_mode: "full" })).toBe("full");
  });

  it("scheduled Monday uses full, other weekdays incremental", () => {
    expect(resolveDeepSleepMode({ trigger: "scheduled", day: "2026-06-15" })).toBe("full");
    expect(resolveDeepSleepMode({ trigger: "scheduled", day: "2026-06-16" })).toBe("incremental");
  });

  it("manual triggers default to full", () => {
    expect(resolveDeepSleepMode({ trigger: "manual_cycle" })).toBe("full");
    expect(resolveDeepSleepMode({ trigger: "manual_step" })).toBe("full");
  });
});
