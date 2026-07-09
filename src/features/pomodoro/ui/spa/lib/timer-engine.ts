import type { PomodoroConfigRow } from "./api.ts";

import type { PomodoroActiveState } from "@freeanima/frontend/shell-sdk/pomodoro-active-types.ts";
import { openWorkFocusSegment } from "@freeanima/frontend/shell-sdk/pomodoro-focus-segments.ts";

export type { PomodoroActiveState };
export type PomodoroPhase = PomodoroActiveState["phase"];
export type TimerRunState = PomodoroActiveState["runState"];

export function phaseDurationMs(config: PomodoroConfigRow, phase: PomodoroPhase): number {
  if (phase === "work") return config.work_minutes * 60_000;
  if (phase === "long_break") return config.long_break_minutes * 60_000;
  return config.short_break_minutes * 60_000;
}

export function phaseLabel(phase: PomodoroPhase): string {
  if (phase === "work") return "专注";
  if (phase === "short_break") return "短休";
  return "长休";
}

export function remainingMs(state: PomodoroActiveState, nowMs: number = Date.now()): number {
  if (state.runState === "paused") return state.pausedRemainingMs ?? 0;
  if (state.phaseEndsAt == null) return state.phasePlannedMs;
  return Math.max(0, state.phaseEndsAt - nowMs);
}

export function nextPhaseAfterComplete(
  config: PomodoroConfigRow,
  phase: PomodoroPhase,
  completedWorkInCycle: number,
): { nextPhase: PomodoroPhase; completedWorkInCycle: number; cycleIndex: number } {
  if (phase === "work") {
    const nextCompleted = completedWorkInCycle + 1;
    const isLong = nextCompleted % config.cycles_before_long_break === 0;
    return {
      nextPhase: isLong ? "long_break" : "short_break",
      completedWorkInCycle: nextCompleted,
      cycleIndex: nextCompleted - 1,
    };
  }
  if (phase === "long_break") {
    return { nextPhase: "work", completedWorkInCycle: 0, cycleIndex: 0 };
  }
  return {
    nextPhase: "work",
    completedWorkInCycle,
    cycleIndex: completedWorkInCycle,
  };
}

export function shouldAutoStartNext(
  config: PomodoroConfigRow,
  completedPhase: PomodoroPhase,
): boolean {
  if (completedPhase === "work") return config.auto_start_break;
  return config.auto_start_work;
}

export function createInitialActiveState(
  config: PomodoroConfigRow,
  opts?: { taskItemId?: number | null; sessionLocalId?: string },
  nowMs: number = Date.now(),
): PomodoroActiveState {
  const sessionLocalId = opts?.sessionLocalId ?? crypto.randomUUID();
  const planned = phaseDurationMs(config, "work");
  const phaseStartedAt = new Date(nowMs).toISOString();
  const base: PomodoroActiveState = {
    phase: "work",
    runState: "running",
    phasePlannedMs: planned,
    phaseEndsAt: nowMs + planned,
    pausedRemainingMs: null,
    cycleIndex: 0,
    completedWorkInCycle: 0,
    taskItemId: opts?.taskItemId ?? null,
    sessionLocalId,
    phaseStartedAt,
    focusSegments: [],
  };
  return openWorkFocusSegment(base, opts?.taskItemId ?? null, nowMs);
}

export function startPhaseState(
  config: PomodoroConfigRow,
  prev: PomodoroActiveState,
  phase: PomodoroPhase,
  cycleIndex: number,
  completedWorkInCycle: number,
  nowMs: number = Date.now(),
): PomodoroActiveState {
  const planned = phaseDurationMs(config, phase);
  const next: PomodoroActiveState = {
    ...prev,
    phase,
    runState: "running",
    phasePlannedMs: planned,
    phaseEndsAt: nowMs + planned,
    pausedRemainingMs: null,
    cycleIndex,
    completedWorkInCycle,
    phaseStartedAt: new Date(nowMs).toISOString(),
    focusSegments: [],
  };
  if (phase === "work") {
    return openWorkFocusSegment(next, prev.taskItemId, nowMs);
  }
  return next;
}

export function pauseActiveState(
  state: PomodoroActiveState,
  nowMs: number = Date.now(),
): PomodoroActiveState {
  if (state.runState !== "running") return state;
  return {
    ...state,
    runState: "paused",
    pausedRemainingMs: remainingMs(state, nowMs),
    phaseEndsAt: null,
  };
}

export function resumeActiveState(
  state: PomodoroActiveState,
  nowMs: number = Date.now(),
): PomodoroActiveState {
  if (state.runState !== "paused") return state;
  const left = state.pausedRemainingMs ?? 0;
  return {
    ...state,
    runState: "running",
    phaseEndsAt: nowMs + left,
    pausedRemainingMs: null,
  };
}

export function actualDurationMs(state: PomodoroActiveState, finishedAtMs: number): number {
  const started = Date.parse(state.phaseStartedAt);
  if (!Number.isFinite(started)) return state.phasePlannedMs;
  return Math.max(0, Math.min(state.phasePlannedMs, finishedAtMs - started));
}
