import { describe, expect, it } from "bun:test";

import {
  canStartPullAtScrollTop,
  clampPullDistance,
  detectTouchPrimaryInput,
  shouldIgnorePullStart,
  shouldTriggerRefresh,
} from "./pull-to-refresh-logic.ts";

describe("pull-to-refresh-logic", () => {
  it("ignores starts near the left edge", () => {
    expect(shouldIgnorePullStart(0)).toBe(true);
    expect(shouldIgnorePullStart(23)).toBe(true);
    expect(shouldIgnorePullStart(24)).toBe(false);
    expect(shouldIgnorePullStart(80, 40)).toBe(false);
    expect(shouldIgnorePullStart(10, 40)).toBe(true);
  });

  it("only allows pull when scrollTop is at top", () => {
    expect(canStartPullAtScrollTop(0)).toBe(true);
    expect(canStartPullAtScrollTop(-1)).toBe(true);
    expect(canStartPullAtScrollTop(1)).toBe(false);
  });

  it("clamps pull distance", () => {
    expect(clampPullDistance(-10)).toBe(0);
    expect(clampPullDistance(40)).toBe(40);
    expect(clampPullDistance(200)).toBe(96);
    expect(clampPullDistance(200, 50)).toBe(50);
  });

  it("triggers refresh past threshold", () => {
    expect(shouldTriggerRefresh(63)).toBe(false);
    expect(shouldTriggerRefresh(64)).toBe(true);
    expect(shouldTriggerRefresh(30, 20)).toBe(true);
  });

  it("detects touch-primary from matchMedia", () => {
    expect(
      detectTouchPrimaryInput(() => ({
        matches: false,
      })),
    ).toBe(true);
    expect(
      detectTouchPrimaryInput((q) => ({
        matches: q.includes("pointer: fine") || q.includes("hover: hover"),
      })),
    ).toBe(false);
  });
});
