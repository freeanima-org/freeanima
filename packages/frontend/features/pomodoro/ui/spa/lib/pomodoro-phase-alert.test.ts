import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { registerAlertBackend, resetAlertBackendForTest } from "@freeanima/client/portal-sdk/alert";
import type { AlertBackend, AlertPayload } from "@freeanima/client/portal-sdk/alert/types.ts";
import type { PomodoroActiveState } from "@freeanima/client/portal-sdk/pomodoro-active-types.ts";

import type { PomodoroConfigRow } from "./api.ts";
import {
  clearPomodoroPhaseAlertScheduleTrackingForTest,
  pomodoroPhaseAlertTag,
  syncPomodoroPhaseLocalAlert,
  wasPomodoroPhaseAlertScheduled,
} from "./pomodoro-phase-alert.ts";

const baseConfig: PomodoroConfigRow = {
  work_minutes: 25,
  short_break_minutes: 5,
  long_break_minutes: 15,
  cycles_before_long_break: 4,
  auto_start_break: true,
  auto_start_work: false,
  notify_on_phase_end: true,
  sound_enabled: false,
};

function runningState(overrides?: Partial<PomodoroActiveState>): PomodoroActiveState {
  return {
    phase: "work",
    runState: "running",
    phasePlannedMs: 60_000,
    phaseEndsAt: Date.now() + 60_000,
    pausedRemainingMs: null,
    cycleIndex: 0,
    completedWorkInCycle: 0,
    taskItemId: null,
    calendarEventId: null,
    sessionLocalId: "sess-1",
    phaseStartedAt: new Date().toISOString(),
    focusSegments: [],
    ...overrides,
  };
}

function mockBackend() {
  const scheduled: Array<{ tag: string; at: number }> = [];
  const cancelled: string[] = [];
  const backend: AlertBackend = {
    platform: "web",
    scheduleDurability: "process",
    readPermission: async () => "granted",
    requestPermission: async () => "granted",
    show: async () => undefined,
    async schedule(payload: AlertPayload, at: Date) {
      const tag = payload.tag ?? "missing";
      scheduled.push({ tag, at: at.getTime() });
      return { id: `mock:${tag}` };
    },
    async cancel(key) {
      if (key.tag) cancelled.push(key.tag);
    },
  };
  registerAlertBackend(backend);
  return { scheduled, cancelled };
}

describe("syncPomodoroPhaseLocalAlert", () => {
  beforeEach(() => {
    resetAlertBackendForTest();
    clearPomodoroPhaseAlertScheduleTrackingForTest();
  });

  afterEach(() => {
    resetAlertBackendForTest();
    clearPomodoroPhaseAlertScheduleTrackingForTest();
  });

  test("running 时 schedule", async () => {
    const { scheduled } = mockBackend();
    const state = runningState();
    await syncPomodoroPhaseLocalAlert(null, state, baseConfig);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]?.tag).toBe(pomodoroPhaseAlertTag(state));
    expect(wasPomodoroPhaseAlertScheduled(pomodoroPhaseAlertTag(state))).toBe(true);
  });

  test("pause 时 cancel", async () => {
    const { cancelled } = mockBackend();
    const running = runningState();
    await syncPomodoroPhaseLocalAlert(null, running, baseConfig);
    const paused = {
      ...running,
      runState: "paused" as const,
      phaseEndsAt: null,
      pausedRemainingMs: 30_000,
    };
    await syncPomodoroPhaseLocalAlert(running, paused, baseConfig);
    expect(cancelled).toContain(pomodoroPhaseAlertTag(running));
    expect(wasPomodoroPhaseAlertScheduled(pomodoroPhaseAlertTag(running))).toBe(false);
  });

  test("abort（next=null）时 cancel", async () => {
    const { cancelled } = mockBackend();
    const running = runningState();
    await syncPomodoroPhaseLocalAlert(null, running, baseConfig);
    await syncPomodoroPhaseLocalAlert(running, null, baseConfig);
    expect(cancelled).toContain(pomodoroPhaseAlertTag(running));
  });

  test("关闭通知配置时 cancel", async () => {
    const { cancelled, scheduled } = mockBackend();
    const running = runningState();
    await syncPomodoroPhaseLocalAlert(null, running, baseConfig);
    await syncPomodoroPhaseLocalAlert(running, running, {
      ...baseConfig,
      notify_on_phase_end: false,
      sound_enabled: false,
    });
    expect(cancelled).toContain(pomodoroPhaseAlertTag(running));
    expect(scheduled).toHaveLength(1);
  });

  test("companion 可见时不 schedule", async () => {
    const { scheduled, cancelled } = mockBackend();
    const prevWindow = globalThis.window;
    (globalThis as { window?: Window }).window = {
      portalShell: {
        getCompanionVisible: async () => true,
        enqueueCompanionBubble: async () => undefined,
      },
    } as unknown as Window;
    try {
      const state = runningState();
      await syncPomodoroPhaseLocalAlert(null, state, baseConfig);
      expect(scheduled).toHaveLength(0);
      expect(wasPomodoroPhaseAlertScheduled(pomodoroPhaseAlertTag(state))).toBe(false);
      expect(cancelled).toContain(pomodoroPhaseAlertTag(state));
    } finally {
      if (prevWindow) (globalThis as { window?: Window }).window = prevWindow;
      else delete (globalThis as { window?: Window }).window;
    }
  });
});
