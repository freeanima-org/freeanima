import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  applyLocalPomodoroActive,
  clearPomodoroSyncMetaForTest,
} from "@freeanima/client/portal-sdk/pomodoro-sync-local.ts";
import { clearPomodoroActiveStateForTest } from "@freeanima/client/portal-sdk/pomodoro-active.ts";
import type { PomodoroActiveState } from "@freeanima/client/portal-sdk/pomodoro-active-types.ts";

import type { PomodoroConfigRow } from "./api.ts";
import { clearHandledPhaseKeysForTest, runPhaseComplete } from "./pomodoro-sync.ts";

const config: PomodoroConfigRow = {
  work_minutes: 25,
  short_break_minutes: 5,
  long_break_minutes: 15,
  cycles_before_long_break: 4,
  auto_start_break: true,
  auto_start_work: false,
  notify_on_phase_end: false,
  sound_enabled: false,
};

function expiredWork(nowMs: number): PomodoroActiveState {
  return {
    phase: "work",
    runState: "running",
    phasePlannedMs: 60_000,
    phaseEndsAt: nowMs - 1_000,
    pausedRemainingMs: null,
    cycleIndex: 0,
    completedWorkInCycle: 0,
    taskItemId: null,
    calendarEventId: null,
    sessionLocalId: "sess-1",
    phaseStartedAt: new Date(nowMs - 60_000).toISOString(),
    focusSegments: [],
  };
}

function mockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

beforeEach(() => {
  globalThis.localStorage = mockLocalStorage();
  clearPomodoroActiveStateForTest();
  clearPomodoroSyncMetaForTest();
  clearHandledPhaseKeysForTest();
  mock.restore();
});

describe("runPhaseComplete stale guard", () => {
  test("本地已不是同一阶段时返回 duplicate", async () => {
    const now = Date.now();
    const stale = expiredWork(now);
    applyLocalPomodoroActive(
      {
        ...stale,
        phase: "short_break",
        phaseEndsAt: now + 300_000,
        phaseStartedAt: new Date(now).toISOString(),
        completedWorkInCycle: 1,
      },
      1,
      { device_id: "d", updated_at_ms: now },
    );

    const result = await runPhaseComplete({
      state: stale,
      config,
      subjectId: 1,
      deliverAlerts: false,
    });
    expect(result).toBe("duplicate");
  });
});
