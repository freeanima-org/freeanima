import { beforeEach, describe, expect, test } from "bun:test";

import type { PomodoroActiveState } from "@freeanima/client/portal-sdk/pomodoro-active-types.ts";
import {
  applyLocalPomodoroActive,
  clearPomodoroSyncMetaForTest,
  getPomodoroSyncSnapshot,
} from "@freeanima/client/portal-sdk/pomodoro-sync-local.ts";
import { clearPomodoroActiveStateForTest } from "@freeanima/client/portal-sdk/pomodoro-active.ts";

import { ensurePomodoroStart } from "./ensure-pomodoro-start.ts";

const config = {
  work_minutes: 25,
  short_break_minutes: 5,
  long_break_minutes: 15,
  cycles_before_long_break: 4,
  auto_start_break: false,
  auto_start_work: false,
  notify_on_phase_end: true,
  sound_enabled: false,
};

const localState: PomodoroActiveState = {
  phase: "work",
  runState: "running",
  phasePlannedMs: 1_500_000,
  phaseEndsAt: Date.now() + 1_500_000,
  pausedRemainingMs: null,
  cycleIndex: 0,
  completedWorkInCycle: 0,
  taskItemId: null,
  calendarEventId: null,
  habitId: null,
  sessionLocalId: "local-session",
  phaseStartedAt: new Date().toISOString(),
  focusSegments: [],
};

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
});

describe("ensurePomodoroStart", () => {
  test("已有 running active 时 adopt 远端而非新建", async () => {
    applyLocalPomodoroActive(localState, 1, {
      device_id: "device-remote",
      updated_at_ms: 9_000,
    });

    const result = await ensurePomodoroStart({ subjectId: 1, config });
    expect(result).toBe("adopted_remote");
    expect(getPomodoroSyncSnapshot(1).active?.sessionLocalId).toBe("local-session");
  });

  test("无 active 时创建新 session", async () => {
    const result = await ensurePomodoroStart({ subjectId: 1, config });
    expect(result).toBe("started");
    expect(getPomodoroSyncSnapshot(1).active?.runState).toBe("running");
    expect(getPomodoroSyncSnapshot(1).active?.sessionLocalId).toBeTruthy();
  });
});
