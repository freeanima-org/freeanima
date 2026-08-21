import { describe, expect, test, beforeEach } from "bun:test";

import type { PomodoroActiveBody } from "@freeanima/shared/entity-shapes";
import type { PomodoroActiveState } from "./pomodoro-active-types.ts";
import {
  applyLocalPomodoroActive,
  clearPomodoroSyncMetaForTest,
  getPomodoroSyncMeta,
  mergeRemoteActive,
} from "./pomodoro-sync-local.ts";
import { clearPomodoroActiveStateForTest } from "./pomodoro-active.ts";

const remoteBody: PomodoroActiveBody = {
  phase: "work",
  run_state: "running",
  phase_planned_ms: 1_500_000,
  phase_ends_at: Date.now() + 1_500_000,
  paused_remaining_ms: null,
  cycle_index: 0,
  completed_work_in_cycle: 0,
  task_item_id: null,
  session_local_id: "remote-session",
  phase_started_at: new Date().toISOString(),
  focus_segments: [],
  device_id: "device-remote",
  updated_at_ms: 2_000,
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
  sessionLocalId: "local-session",
  phaseStartedAt: new Date().toISOString(),
  focusSegments: [],
};

beforeEach(() => {
  clearPomodoroActiveStateForTest();
  clearPomodoroSyncMetaForTest();
});

describe("mergeRemoteActive", () => {
  test("adopts remote when local is empty", () => {
    const merged = mergeRemoteActive(remoteBody, null, null);
    expect(merged.active?.sessionLocalId).toBe("remote-session");
    expect(merged.meta?.device_id).toBe("device-remote");
  });

  test("prefers remote when remote updated_at_ms is newer", () => {
    const merged = mergeRemoteActive(remoteBody, localState, {
      device_id: "device-local",
      updated_at_ms: 1_000,
    });
    expect(merged.active?.sessionLocalId).toBe("remote-session");
  });

  test("keeps local when local meta is newer", () => {
    const merged = mergeRemoteActive(remoteBody, localState, {
      device_id: "device-local",
      updated_at_ms: 3_000,
    });
    expect(merged.active?.sessionLocalId).toBe("local-session");
  });

  test("preferRemote always adopts remote even if local meta is newer", () => {
    const merged = mergeRemoteActive(
      remoteBody,
      localState,
      { device_id: "device-local", updated_at_ms: 9_000 },
      { preferRemote: true },
    );
    expect(merged.active?.sessionLocalId).toBe("remote-session");
  });

  test("preferRemote clears when remote is null", () => {
    const merged = mergeRemoteActive(
      null,
      localState,
      {
        device_id: "device-local",
        updated_at_ms: 9_000,
      },
      { preferRemote: true },
    );
    expect(merged.active).toBeNull();
    expect(merged.meta).toBeNull();
  });
});

describe("pomodoro sync meta persistence", () => {
  test("persists meta to localStorage", () => {
    applyLocalPomodoroActive(localState, "user", {
      device_id: "device-local",
      updated_at_ms: 5_000,
    });
    expect(getPomodoroSyncMeta("user")?.updated_at_ms).toBe(5_000);
  });
});
