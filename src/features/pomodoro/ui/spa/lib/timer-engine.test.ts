import { describe, expect, test } from "bun:test";

import {
  createInitialActiveState,
  nextPhaseAfterComplete,
  pauseActiveState,
  remainingMs,
  resumeActiveState,
} from "./timer-engine.ts";
import type { PomodoroConfigRow } from "./api.ts";

const config: PomodoroConfigRow = {
  work_minutes: 25,
  short_break_minutes: 5,
  long_break_minutes: 15,
  cycles_before_long_break: 4,
  auto_start_break: true,
  auto_start_work: false,
  notify_on_phase_end: true,
  sound_enabled: true,
};

describe("timer-engine", () => {
  test("remainingMs decreases while running", () => {
    const now = 1_000_000;
    const state = createInitialActiveState(config, {}, now);
    expect(remainingMs(state, now + 60_000)).toBe(24 * 60_000);
  });

  test("pause freezes remaining", () => {
    const now = 1_000_000;
    const running = createInitialActiveState(config, {}, now);
    const paused = pauseActiveState(running, now + 30_000);
    expect(remainingMs(paused, now + 120_000)).toBe(remainingMs(paused, now + 30_000));
  });

  test("resume continues countdown", () => {
    const now = 1_000_000;
    const running = createInitialActiveState(config, {}, now);
    const paused = pauseActiveState(running, now + 30_000);
    const resumed = resumeActiveState(paused, now + 60_000);
    expect(remainingMs(resumed, now + 90_000)).toBeLessThan(remainingMs(paused, now + 30_000));
  });

  test("long break after N work sessions", () => {
    let completed = 0;
    for (let i = 0; i < 3; i++) {
      const next = nextPhaseAfterComplete(config, "work", completed);
      expect(next.nextPhase).toBe("short_break");
      completed = next.completedWorkInCycle;
    }
    const fourth = nextPhaseAfterComplete(config, "work", completed);
    expect(fourth.nextPhase).toBe("long_break");
  });
});
