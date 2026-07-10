import type { PomodoroActiveState } from "./pomodoro-active-types.ts";

/** 阶段结算的有效结束时刻（ms），过期 running 用 phaseEndsAt 而非墙钟 now。 */
export function effectivePhaseFinishedAtMs(
  state: PomodoroActiveState,
  nowMs: number = Date.now(),
): number {
  if (state.runState === "paused") {
    const started = Date.parse(state.phaseStartedAt);
    if (!Number.isFinite(started)) return nowMs;
    const elapsed = state.phasePlannedMs - (state.pausedRemainingMs ?? 0);
    return started + Math.max(0, elapsed);
  }
  if (state.runState === "running" && state.phaseEndsAt != null && nowMs >= state.phaseEndsAt) {
    return state.phaseEndsAt;
  }
  return nowMs;
}

export function effectiveFinishedAtIso(
  state: PomodoroActiveState,
  nowMs: number = Date.now(),
): string {
  return new Date(effectivePhaseFinishedAtMs(state, nowMs)).toISOString();
}

export function actualDurationMs(state: PomodoroActiveState, nowMs: number = Date.now()): number {
  const started = Date.parse(state.phaseStartedAt);
  const finished = effectivePhaseFinishedAtMs(state, nowMs);
  if (!Number.isFinite(started)) return state.phasePlannedMs;
  return Math.max(0, Math.min(state.phasePlannedMs, finished - started));
}
