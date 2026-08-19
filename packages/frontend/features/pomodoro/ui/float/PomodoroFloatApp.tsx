import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  useHabitatConnection,
  useNetworkOnline,
  useSubjectScope,
} from "@freeanima/client/portal-sdk/react.tsx";
import { whenPortalHabitatRpcReady } from "@freeanima/client/portal-sdk/habitat-rpc-call";
import { reconnectHabitat } from "@freeanima/client/portal-sdk/habitat-connection.ts";
import {
  formatPomodoroClock,
  pomodoroPhaseLabel,
  pomodoroRemainingMs,
} from "@freeanima/client/portal-sdk/pomodoro-remaining.ts";
import {
  getPomodoroSyncSnapshot,
  subscribePomodoroSync,
} from "@freeanima/client/portal-sdk/pomodoro-sync-local.ts";
import { readPomodoroActiveState } from "@freeanima/client/portal-sdk/pomodoro-active.ts";
import type { PomodoroActiveState } from "@freeanima/client/portal-sdk/pomodoro-active-types.ts";
import {
  POMODORO_ACTIVE_CHANGED_EVENT,
  pomodoroActiveChangedEventSchema,
} from "@freeanima/shared/rpc-contract/frames/pomodoro";

import {
  applyPomodoroActive,
  applyPomodoroActiveChangedEvent,
  pullPomodoroActive,
} from "../spa/lib/pomodoro-sync.ts";
import { pauseActiveState, resumeActiveState } from "../spa/lib/timer-engine.ts";

const TICK_MS = 250;

function readActive(subjectKind: "user" | "agent"): PomodoroActiveState | null {
  return (
    getPomodoroSyncSnapshot(subjectKind).active ?? readPomodoroActiveState(undefined, subjectKind)
  );
}

export function PomodoroFloatApp() {
  const { kind: subjectKind } = useSubjectScope();
  const networkOnline = useNetworkOnline();
  const habitatConnection = useHabitatConnection();
  const [active, setActive] = useState<PomodoroActiveState | null>(() => readActive(subjectKind));
  const [, setTick] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void reconnectHabitat().catch(() => undefined);
  }, []);

  useEffect(() => {
    const refresh = () => setActive(readActive(subjectKind));
    const unsub = subscribePomodoroSync(() => refresh());
    const onCustom = (event: Event) => {
      const detail = (event as CustomEvent<{ subjectKind?: string }>).detail;
      if (detail?.subjectKind === subjectKind) refresh();
    };
    window.addEventListener("freeanima:pomodoro-active-changed", onCustom);
    refresh();
    return () => {
      unsub();
      window.removeEventListener("freeanima:pomodoro-active-changed", onCustom);
    };
  }, [subjectKind]);

  useEffect(() => {
    if (!networkOnline || habitatConnection !== "connected") return;
    void pullPomodoroActive(subjectKind).then(() => setActive(readActive(subjectKind)));
  }, [networkOnline, habitatConnection, subjectKind]);

  useEffect(() => {
    if (!networkOnline || habitatConnection !== "connected") return () => {};
    let cancelled = false;
    let off: (() => void) | undefined;
    void whenPortalHabitatRpcReady().then((rpc) => {
      if (cancelled) return;
      off = rpc.onEvent(POMODORO_ACTIVE_CHANGED_EVENT, (payload) => {
        const parsed = pomodoroActiveChangedEventSchema.safeParse(payload);
        if (!parsed.success) return;
        if (parsed.data.subject_kind !== subjectKind) return;
        applyPomodoroActiveChangedEvent(subjectKind, parsed.data.active);
        setActive(readActive(subjectKind));
      });
    });
    return () => {
      cancelled = true;
      off?.();
    };
  }, [networkOnline, habitatConnection, subjectKind]);

  useEffect(() => {
    if (!active || (active.runState !== "running" && active.runState !== "paused")) {
      return () => {};
    }
    const id = window.setInterval(() => setTick((n) => n + 1), TICK_MS);
    return () => window.clearInterval(id);
  }, [active]);

  const onDragStart = useCallback((event: MouseEvent) => {
    if (event.button !== 0) return;
    void getCurrentWindow()
      .startDragging()
      .catch(() => undefined);
  }, []);

  const togglePause = useCallback(() => {
    if (!active || busy) return;
    setBusy(true);
    const next =
      active.runState === "paused" ? resumeActiveState(active) : pauseActiveState(active);
    void applyPomodoroActive(next, subjectKind)
      .then(() => setActive(readActive(subjectKind)))
      .finally(() => setBusy(false));
  }, [active, busy, subjectKind]);

  const openFull = useCallback(() => {
    void window.portalShell?.openPomodoro?.();
  }, []);

  if (!active || (active.runState !== "running" && active.runState !== "paused")) {
    return (
      <div className="pomodoro-float">
        <div className="pomodoro-float-top" onMouseDown={onDragStart}>
          <span className="pomodoro-float-empty">无进行中的番茄</span>
        </div>
        <div className="pomodoro-float-actions">
          <button type="button" onClick={openFull}>
            打开
          </button>
        </div>
      </div>
    );
  }

  const rem = pomodoroRemainingMs(active);
  const phaseText =
    active.runState === "paused"
      ? `暂停 · ${pomodoroPhaseLabel(active.phase)}`
      : pomodoroPhaseLabel(active.phase);
  const pauseLabel = active.runState === "paused" ? "继续" : "暂停";

  return (
    <div className="pomodoro-float">
      <div className="pomodoro-float-top" onMouseDown={onDragStart}>
        <span className="pomodoro-float-phase">{phaseText}</span>
        <span className="pomodoro-float-clock">{formatPomodoroClock(rem)}</span>
      </div>
      <div className="pomodoro-float-actions">
        <button type="button" disabled={busy} onClick={togglePause}>
          {pauseLabel}
        </button>
        <button type="button" onClick={openFull}>
          打开
        </button>
      </div>
    </div>
  );
}
