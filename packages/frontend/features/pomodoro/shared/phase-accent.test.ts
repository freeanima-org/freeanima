import { describe, expect, test } from "bun:test";

import {
  POMODORO_PHASE_ACCENT,
  pomodoroPhaseAccentCss,
  pomodoroPhaseAccentKind,
} from "./phase-accent.ts";

describe("pomodoroPhaseAccentKind", () => {
  test("work 映射为 work", () => {
    expect(pomodoroPhaseAccentKind("work")).toBe("work");
  });

  test("短休与长休映射为 break", () => {
    expect(pomodoroPhaseAccentKind("short_break")).toBe("break");
    expect(pomodoroPhaseAccentKind("long_break")).toBe("break");
  });
});

describe("pomodoroPhaseAccentCss", () => {
  test("专注为蓝、休息为绿", () => {
    expect(pomodoroPhaseAccentCss("work")).toBe(POMODORO_PHASE_ACCENT.work);
    expect(pomodoroPhaseAccentCss("short_break")).toBe(POMODORO_PHASE_ACCENT.break);
    expect(pomodoroPhaseAccentCss("long_break")).toBe(POMODORO_PHASE_ACCENT.break);
  });
});
