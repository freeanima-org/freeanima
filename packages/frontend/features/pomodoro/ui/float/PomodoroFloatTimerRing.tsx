import type { MouseEvent } from "react";
import {
  formatPomodoroClock,
  pomodoroPhaseLabel,
} from "@freeanima/client/portal-sdk/pomodoro-remaining.ts";
import type { PomodoroActiveState } from "@freeanima/client/portal-sdk/pomodoro-active-types.ts";
import { cn } from "@freeanima/ui-kit";
import { pomodoroPhaseAccentCss } from "../../shared/phase-accent.ts";
import { progressRatio } from "./edge-dock.ts";

type PomodoroFloatTimerRingProps = {
  active: PomodoroActiveState | null;
  remainingMs: number;
  plannedMs: number;
  defaultWorkMinutes?: number;
  onDragStart: (event: MouseEvent) => void;
};

function phaseText(active: PomodoroActiveState | null): string {
  if (!active) return "就绪";
  const label = pomodoroPhaseLabel(active.phase);
  if (active.runState === "paused") return `暂停 · ${label}`;
  return label;
}

function ringStyle(
  active: PomodoroActiveState | null,
  progress: number,
): { borderColor?: string; background?: string } {
  if (!active) {
    return {
      background: `conic-gradient(hsl(var(--primary)) ${progress * 360}deg, transparent 0)`,
    };
  }
  const accent = pomodoroPhaseAccentCss(active.phase);
  return {
    borderColor: `color-mix(in srgb, ${accent} 30%, transparent)`,
    background: `conic-gradient(${accent} ${progress * 360}deg, transparent 0)`,
  };
}

export function PomodoroFloatTimerRing({
  active,
  remainingMs,
  plannedMs,
  defaultWorkMinutes = 25,
  onDragStart,
}: PomodoroFloatTimerRingProps) {
  const progress = active ? progressRatio(remainingMs, plannedMs) : 0;
  const clock = active
    ? formatPomodoroClock(remainingMs)
    : formatPomodoroClock(defaultWorkMinutes * 60_000);

  return (
    <div className="cursor-grab select-none" onMouseDown={onDragStart} role="presentation">
      <div
        className={cn(
          "relative flex h-20 w-20 items-center justify-center rounded-full border-4",
          !active && "border-primary/30",
        )}
        style={ringStyle(active, progress)}
      >
        <div className="bg-background flex h-[4.25rem] w-[4.25rem] flex-col items-center justify-center rounded-full">
          <span
            className={cn("text-[0.65rem] leading-tight", !active && "text-muted-foreground")}
            style={active ? { color: pomodoroPhaseAccentCss(active.phase) } : undefined}
          >
            {phaseText(active)}
          </span>
          <span className="font-mono text-xl tabular-nums leading-none">{clock}</span>
        </div>
      </div>
    </div>
  );
}
