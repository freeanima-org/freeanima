import type { PomodoroPhase } from "@freeanima/client/portal-sdk/pomodoro-active-types.ts";

export type PomodoroPhaseAccentKind = "work" | "break";

/** 专注 / 休息 固定语义色（不随全局 --primary 变化） */
export const POMODORO_PHASE_ACCENT = {
  work: "hsl(217 85% 56%)",
  break: "hsl(142 70% 45%)",
} as const satisfies Record<PomodoroPhaseAccentKind, string>;

export function pomodoroPhaseAccentKind(phase: PomodoroPhase): PomodoroPhaseAccentKind {
  return phase === "work" ? "work" : "break";
}

export function pomodoroPhaseAccentCss(phase: PomodoroPhase): string {
  return POMODORO_PHASE_ACCENT[pomodoroPhaseAccentKind(phase)];
}
