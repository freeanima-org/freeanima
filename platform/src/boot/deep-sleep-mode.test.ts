import { describe, expect, it } from "bun:test";

import { resolveDeepSleepMode } from "./deep-sleep-mode.ts";

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
