import { useEffect, useRef } from "react";
import { getSubjectKind } from "@freeanima/frontend/shell-sdk/subject-scope-store.ts";
import {
  useHubConnection,
  useNetworkOnline,
  useSubjectScope,
} from "@freeanima/frontend/shell-sdk/react.tsx";
import {
  getPomodoroSyncSnapshot,
  subscribePomodoroSync,
} from "@freeanima/frontend/shell-sdk/pomodoro-sync-local.ts";
import { readPomodoroActiveState } from "@freeanima/frontend/shell-sdk/pomodoro-active.ts";

import { fetchPomodoroConfig } from "./lib/api.ts";
import { flushPomodoroOutbox, pullPomodoroActive, runPhaseComplete } from "./lib/pomodoro-sync.ts";
import { remainingMs } from "./lib/timer-engine.ts";

const POLL_MS = 1_000;
const REMOTE_PULL_MS = 30_000;

export function PomodoroShellWatcher() {
  const { kind: subjectKind } = useSubjectScope();
  const networkOnline = useNetworkOnline();
  const hubConnection = useHubConnection();
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
    if (!networkOnline || hubConnection !== "connected") return;
    void pullPomodoroActive(subjectKind);
    flushPomodoroOutbox();
  }, [networkOnline, hubConnection, subjectKind]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void pullPomodoroActive(subjectKind);
      flushPomodoroOutbox();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [subjectKind]);

  useEffect(() => {
    const remotePull = window.setInterval(() => {
      if (networkOnline && hubConnection === "connected") {
        void pullPomodoroActive(subjectKind);
      }
    }, REMOTE_PULL_MS);
    return () => clearInterval(remotePull);
  }, [subjectKind, networkOnline, hubConnection]);

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

  return null;
}

/** 供非 React 场景读取 subject（测试）。 */
export function readWatcherSubjectKind(): "user" | "agent" {
  return getSubjectKind();
}
