import { useEffect, useState } from "react";

import { isRecord } from "@freeanima/shared/util";

import { readPomodoroActiveState } from "./pomodoro-active.ts";
import type { PomodoroActiveState } from "./pomodoro-active-types.ts";
import {
  formatPomodoroClock,
  formatPomodoroNavLabel,
  pomodoroRemainingMs,
} from "./pomodoro-remaining.ts";
import { getPomodoroSyncSnapshot, subscribePomodoroSync } from "./pomodoro-sync-local.ts";
import { useSubjectScope } from "./subject-scope-react.tsx";

const TICK_MS = 500;

export type PomodoroNavCountdown = {
  active: PomodoroActiveState | null;
  clock: string | null;
  navLabel: string | null;
  remainingMs: number;
};

/** 壳导航用：订阅 active + 本地 tick，无会话时返回 null 文案。 */
export function usePomodoroNavCountdown(): PomodoroNavCountdown {
  const { kind: subjectKind } = useSubjectScope();
  const [active, setActive] = useState<PomodoroActiveState | null>(
    () =>
      getPomodoroSyncSnapshot(subjectKind).active ??
      readPomodoroActiveState(undefined, subjectKind),
  );
  const [, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setActive(
        getPomodoroSyncSnapshot(subjectKind).active ??
          readPomodoroActiveState(undefined, subjectKind),
      );
    };
    const unsub = subscribePomodoroSync(() => refresh());
    const onCustom = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail: unknown = event.detail;
      if (!isRecord(detail)) return;
      if (detail.subjectKind === subjectKind) refresh();
    };
    const onStorage = (event: StorageEvent) => {
      if (!event.key?.startsWith("freeanima.pomodoro.active:")) return;
      if (event.key.endsWith(`:${subjectKind}`)) refresh();
    };
    window.addEventListener("freeanima:pomodoro-active-changed", onCustom);
    window.addEventListener("storage", onStorage);
    refresh();
    return () => {
      unsub();
      window.removeEventListener("freeanima:pomodoro-active-changed", onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, [subjectKind]);

  useEffect(() => {
    if (!active || (active.runState !== "running" && active.runState !== "paused")) {
      return () => {};
    }
    const id = window.setInterval(() => setTick((n) => n + 1), TICK_MS);
    return () => window.clearInterval(id);
  }, [active]);

  if (!active || (active.runState !== "running" && active.runState !== "paused")) {
    return { active: null, clock: null, navLabel: null, remainingMs: 0 };
  }

  const rem = pomodoroRemainingMs(active);
  return {
    active,
    clock: formatPomodoroClock(rem),
    navLabel: formatPomodoroNavLabel(active),
    remainingMs: rem,
  };
}
