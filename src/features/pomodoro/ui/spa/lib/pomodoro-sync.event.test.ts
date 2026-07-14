import { beforeEach, describe, expect, test } from "bun:test";

import {
  applyLocalPomodoroActive,
  clearPomodoroSyncMetaForTest,
  getPomodoroSyncMeta,
  getPomodoroSyncSnapshot,
} from "@freeanima/frontend/shell-sdk/pomodoro-sync-local.ts";
import { clearPomodoroActiveStateForTest } from "@freeanima/frontend/shell-sdk/pomodoro-active.ts";
import type { PomodoroActiveState } from "@freeanima/frontend/shell-sdk/pomodoro-active-types.ts";
import type { PomodoroActiveBody } from "@freeanima/core/db/schema/entity";

import { applyPomodoroActiveChangedEvent } from "./pomodoro-sync.ts";

const localState: PomodoroActiveState = {
  phase: "work",
  runState: "running",
  phasePlannedMs: 1_500_000,
  phaseEndsAt: Date.now() + 1_500_000,
  pausedRemainingMs: null,
  cycleIndex: 0,
  completedWorkInCycle: 0,
  taskItemId: null,
  sessionLocalId: "local-session",
  phaseStartedAt: new Date().toISOString(),
  focusSegments: [],
};

const remoteBody: PomodoroActiveBody = {
  phase: "short_break",
  run_state: "running",
  phase_planned_ms: 300_000,
  phase_ends_at: Date.now() + 300_000,
  paused_remaining_ms: null,
  cycle_index: 0,
  completed_work_in_cycle: 1,
  task_item_id: null,
  session_local_id: "remote-session",
  phase_started_at: new Date().toISOString(),
  focus_segments: [],
  device_id: "device-remote",
  updated_at_ms: 9_000,
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

describe("applyPomodoroActiveChangedEvent", () => {
  test("active=null 清空本地", () => {
    applyLocalPomodoroActive(localState, "user", {
      device_id: "device-local",
      updated_at_ms: 1_000,
    });
    applyPomodoroActiveChangedEvent("user", null);
    expect(getPomodoroSyncSnapshot("user").active).toBeNull();
    expect(getPomodoroSyncMeta("user")).toBeNull();
  });

  test("active 非空时按 LWW 合并", () => {
    applyLocalPomodoroActive(localState, "user", {
      device_id: "device-local",
      updated_at_ms: 1_000,
    });
    applyPomodoroActiveChangedEvent("user", remoteBody);
    expect(getPomodoroSyncSnapshot("user").active?.sessionLocalId).toBe("remote-session");
    expect(getPomodoroSyncMeta("user")?.updated_at_ms).toBe(9_000);
  });
});
