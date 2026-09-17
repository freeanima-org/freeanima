import type { PomodoroActiveState, PomodoroPhase } from "./pomodoro-active-types.ts";

export function pomodoroRemainingMs(
  state: PomodoroActiveState,
  nowMs: number = Date.now(),
): number {
  if (state.runState === "paused") return state.pausedRemainingMs ?? 0;
  if (state.phaseEndsAt == null) return state.phasePlannedMs;
  return Math.max(0, state.phaseEndsAt - nowMs);
}

export function formatPomodoroClock(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function pomodoroPhaseLabel(phase: PomodoroPhase): string {
  if (phase === "work") return "专注";
  if (phase === "short_break") return "短休";
  return "长休";
}

/** 导航/小窗用短状态文案：专注 · 24:53 / 暂停 · 12:00 */
export function formatPomodoroNavLabel(
  state: PomodoroActiveState,
  nowMs: number = Date.now(),
): string {
  const clock = formatPomodoroClock(pomodoroRemainingMs(state, nowMs));
  if (state.runState === "paused") return `暂停 · ${clock}`;
  return `${pomodoroPhaseLabel(state.phase)} · ${clock}`;
}
