import { useEffect } from "react";
import {
  useHabitatConnection,
  useNetworkOnline,
  useUserSubjectId,
} from "@freeanima/client/portal-sdk/react.tsx";
import { getPomodoroSyncSnapshot } from "@freeanima/client/portal-sdk/pomodoro-sync-local.ts";
import { readPomodoroActiveState } from "@freeanima/client/portal-sdk/pomodoro-active.ts";
import { whenPortalHabitatRpcReady } from "@freeanima/client/portal-sdk/habitat-rpc-call";
import {
  POMODORO_ACTIVE_CHANGED_EVENT,
  pomodoroActiveChangedEventSchema,
} from "@freeanima/shared/rpc-contract/frames/pomodoro";

import { fetchPomodoroConfig } from "./lib/api.ts";
import { syncPomodoroPhaseLocalAlert } from "./lib/pomodoro-phase-alert.ts";
import { bindPomodoroPhaseCompleteTick } from "./lib/pomodoro-phase-complete-tick.ts";
import {
  applyPomodoroActiveChangedEvent,
  flushPomodoroOutbox,
  pullPomodoroActive,
} from "./lib/pomodoro-sync.ts";
import { bindPomodoroShellActiveSync } from "./lib/pomodoro-shell-sync.ts";

export function PomodoroShellWatcher() {
  const subjectId = useUserSubjectId();
  const networkOnline = useNetworkOnline();
  const habitatConnection = useHabitatConnection();

  useEffect(() => {
    return bindPomodoroShellActiveSync(subjectId);
  }, [subjectId]);

  useEffect(() => {
    if (!networkOnline || habitatConnection !== "connected") return;
    void pullPomodoroActive(subjectId);
    flushPomodoroOutbox();
  }, [networkOnline, habitatConnection, subjectId]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void pullPomodoroActive(subjectId);
      flushPomodoroOutbox();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [subjectId]);

  /** 伴侣显隐变化：可见则取消 OS 预登记；隐藏则按当前阶段重新 schedule */
  useEffect(() => {
    const shell = window.portalShell;
    if (!shell?.listenConfigChanged) return () => {};
    return shell.listenConfigChanged(() => {
      void (async () => {
        const active =
          getPomodoroSyncSnapshot(subjectId).active ??
          readPomodoroActiveState(undefined, subjectId);
        if (!active || active.runState !== "running") return;
        try {
          const config = await fetchPomodoroConfig(subjectId);
          await syncPomodoroPhaseLocalAlert(active, active, config);
        } catch {
          /* 忽略：下次 tick / 配置变更再试 */
        }
      })();
    });
  }, [subjectId]);

  useEffect(() => {
    if (!networkOnline || habitatConnection !== "connected") return () => {};
    let cancelled = false;
    let off: (() => void) | undefined;
    void whenPortalHabitatRpcReady().then((rpc) => {
      if (cancelled) return;
      off = rpc.onEvent(POMODORO_ACTIVE_CHANGED_EVENT, (payload) => {
        const parsed = pomodoroActiveChangedEventSchema.safeParse(payload);
        if (!parsed.success) return;
        if (parsed.data.subject_id !== subjectId) return;
        applyPomodoroActiveChangedEvent(subjectId, parsed.data.active);
      });
    });
    return () => {
      cancelled = true;
      off?.();
    };
  }, [networkOnline, habitatConnection, subjectId]);

  useEffect(() => {
    return bindPomodoroPhaseCompleteTick(subjectId);
  }, [subjectId]);

  return null;
}
