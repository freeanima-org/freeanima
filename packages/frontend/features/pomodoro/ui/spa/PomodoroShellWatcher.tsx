import { useEffect, useRef } from "react";
import { getSubjectKind } from "@freeanima/client/portal-sdk/subject-scope-store.ts";
import {
  useHabitatConnection,
  useNetworkOnline,
  useSubjectScope,
} from "@freeanima/client/portal-sdk/react.tsx";
import {
  getPomodoroSyncSnapshot,
  subscribePomodoroSync,
} from "@freeanima/client/portal-sdk/pomodoro-sync-local.ts";
import { readPomodoroActiveState } from "@freeanima/client/portal-sdk/pomodoro-active.ts";
import { whenPortalHabitatRpcReady } from "@freeanima/client/portal-sdk/habitat-rpc-call";
import {
  POMODORO_ACTIVE_CHANGED_EVENT,
  pomodoroActiveChangedEventSchema,
} from "@freeanima/shared/rpc-contract/frames/pomodoro";

import { fetchPomodoroConfig } from "./lib/api.ts";
import { syncPomodoroPhaseLocalAlert } from "./lib/pomodoro-phase-alert.ts";
import {
  applyPomodoroActiveChangedEvent,
  flushPomodoroOutbox,
  pullPomodoroActive,
  runPhaseComplete,
} from "./lib/pomodoro-sync.ts";
import { remainingMs } from "./lib/timer-engine.ts";

const POLL_MS = 1_000;

export function PomodoroShellWatcher() {
  const { kind: subjectKind } = useSubjectScope();
  const networkOnline = useNetworkOnline();
  const habitatConnection = useHabitatConnection();
  const tickRef = useRef(0);
  const completingRef = useRef(false);

  useEffect(() => {
    const bump = () => {
      tickRef.current += 1;
    };
    const unsub = subscribePomodoroSync(bump);
    const onCustom = (event: Event) => {
      const detail = (event as CustomEvent<{ subjectKind?: string }>).detail;
      if (detail?.subjectKind === subjectKind) bump();
    };
    const onStorage = (event: StorageEvent) => {
      if (!event.key?.startsWith("freeanima.pomodoro.active:")) return;
      if (event.key.endsWith(`:${subjectKind}`)) bump();
    };
    window.addEventListener("freeanima:pomodoro-active-changed", onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("freeanima:pomodoro-active-changed", onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, [subjectKind]);

  useEffect(() => {
    if (!networkOnline || habitatConnection !== "connected") return;
    void pullPomodoroActive(subjectKind);
    flushPomodoroOutbox();
  }, [networkOnline, habitatConnection, subjectKind]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void pullPomodoroActive(subjectKind);
      flushPomodoroOutbox();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [subjectKind]);

  /** 伴侣显隐变化：可见则取消 OS 预登记；隐藏则按当前阶段重新 schedule */
  useEffect(() => {
    const shell = window.portalShell;
    if (!shell?.listenConfigChanged) return () => {};
    return shell.listenConfigChanged(() => {
      void (async () => {
        const active =
          getPomodoroSyncSnapshot(subjectKind).active ??
          readPomodoroActiveState(undefined, subjectKind);
        if (!active || active.runState !== "running") return;
        try {
          const config = await fetchPomodoroConfig(subjectKind);
          await syncPomodoroPhaseLocalAlert(active, active, config);
        } catch {
          /* 忽略：下次 tick / 配置变更再试 */
        }
      })();
    });
  }, [subjectKind]);

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
      });
    });
    return () => {
      cancelled = true;
      off?.();
    };
  }, [networkOnline, habitatConnection, subjectKind]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void (async () => {
        if (completingRef.current) return;
        const active =
          getPomodoroSyncSnapshot(subjectKind).active ??
          readPomodoroActiveState(undefined, subjectKind);
        if (!active || active.runState !== "running") return;
        if (remainingMs(active) > 0) return;
        completingRef.current = true;
        try {
          const config = await fetchPomodoroConfig(subjectKind);
          await runPhaseComplete({ state: active, config, subjectKind });
        } catch {
          /* 下次 tick 重试 */
        } finally {
          completingRef.current = false;
        }
      })();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [subjectKind]);

  /** 桌面：有进行中会话则显示番茄迷你窗；结束后 hide */
  useEffect(() => {
    const shell = window.portalShell;
    if (!shell?.setPomodoroFloatVisible) return () => {};
    let lastVisible: boolean | null = null;
    const syncFloat = () => {
      const active =
        getPomodoroSyncSnapshot(subjectKind).active ??
        readPomodoroActiveState(undefined, subjectKind);
      const visible =
        active != null && (active.runState === "running" || active.runState === "paused");
      if (lastVisible === visible) return;
      lastVisible = visible;
      void shell.setPomodoroFloatVisible?.(visible).catch(() => undefined);
    };
    const unsub = subscribePomodoroSync(syncFloat);
    const onCustom = (event: Event) => {
      const detail = (event as CustomEvent<{ subjectKind?: string }>).detail;
      if (detail?.subjectKind === subjectKind) syncFloat();
    };
    window.addEventListener("freeanima:pomodoro-active-changed", onCustom);
    syncFloat();
    return () => {
      unsub();
      window.removeEventListener("freeanima:pomodoro-active-changed", onCustom);
      void shell.setPomodoroFloatVisible?.(false).catch(() => undefined);
    };
  }, [subjectKind]);

  return null;
}

/** 供非 React 场景读取 subject（测试）。 */
export function readWatcherSubjectKind(): "user" | "agent" {
  return getSubjectKind();
}
