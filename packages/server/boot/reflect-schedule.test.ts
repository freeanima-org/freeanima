import { describe, expect, it } from "bun:test";

import { resolveReflectMode, shouldSkipScheduledReflect } from "./reflect-schedule.ts";

describe("shouldSkipScheduledReflect", () => {
  it("skips non-Monday scheduled runs", () => {
    expect(shouldSkipScheduledReflect({ trigger: "scheduled", day: "2026-06-16" })).toBe(true);
  });

  it("runs on Monday scheduled", () => {
    expect(shouldSkipScheduledReflect({ trigger: "scheduled", day: "2026-06-15" })).toBe(false);
  });

  it("skips scheduled without day", () => {
    expect(shouldSkipScheduledReflect({ trigger: "scheduled" })).toBe(true);
  });

  it("does not skip manual or catch_up", () => {
    expect(shouldSkipScheduledReflect({ trigger: "manual_cycle", day: "2026-06-16" })).toBe(false);
    expect(shouldSkipScheduledReflect({ trigger: "manual_step", day: "2026-06-16" })).toBe(false);
    expect(shouldSkipScheduledReflect({ trigger: "catch_up", day: "2026-06-16" })).toBe(false);
  });
});

describe("resolveReflectMode", () => {
  it("honors explicit reflect_mode", () => {
    expect(resolveReflectMode({ reflect_mode: "incremental" })).toBe("incremental");
    expect(resolveReflectMode({ reflect_mode: "full" })).toBe("full");
  });

  it("still accepts deprecated deep_sleep_mode alias", () => {
    expect(resolveReflectMode({ deep_sleep_mode: "incremental" })).toBe("incremental");
  });

  it("uses full on Monday scheduled, incremental otherwise", () => {
    expect(resolveReflectMode({ trigger: "scheduled", day: "2026-06-15" })).toBe("full");
    expect(resolveReflectMode({ trigger: "scheduled", day: "2026-06-16" })).toBe("incremental");
  });

  it("defaults full for manual triggers", () => {
    expect(resolveReflectMode({ trigger: "manual_cycle" })).toBe("full");
    expect(resolveReflectMode({ trigger: "manual_step" })).toBe("full");
  });
});
