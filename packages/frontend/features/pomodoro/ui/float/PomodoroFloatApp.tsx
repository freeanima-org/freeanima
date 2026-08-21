import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { getCurrentWindow, currentMonitor, primaryMonitor } from "@tauri-apps/api/window";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
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
import { isRecord, randomPublicId } from "@freeanima/shared/util";

import { fetchPomodoroConfig } from "../spa/lib/api.ts";
import {
  applyPomodoroActive,
  applyPomodoroActiveChangedEvent,
  pullPomodoroActive,
  runPhaseAbort,
} from "../spa/lib/pomodoro-sync.ts";
import { bindPomodoroShellActiveSync } from "../spa/lib/pomodoro-shell-sync.ts";
import {
  createInitialActiveState,
  pauseActiveState,
  resumeActiveState,
} from "../spa/lib/timer-engine.ts";
import {
  detectDockEdge,
  framesClose,
  progressRatio,
  snapCollapsedFrame,
  snapExpandedNearEdge,
  type DockEdge,
  type RectPx,
} from "./edge-dock.ts";

const TICK_MS = 250;
const DOCK_STORAGE_KEY = "freeanima:pomodoro-float:dock:v1";
const HOVER_COLLAPSE_MS = 400;
const MOVE_SETTLE_MS = 180;

type DockPersist = { edge: DockEdge | null };

function readActive(subjectKind: "user" | "agent"): PomodoroActiveState | null {
  return (
    getPomodoroSyncSnapshot(subjectKind).active ?? readPomodoroActiveState(undefined, subjectKind)
  );
}

function loadDock(): DockPersist {
  try {
    const raw = localStorage.getItem(DOCK_STORAGE_KEY);
    if (!raw) return { edge: null };
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      "edge" in parsed &&
      (parsed.edge === null ||
        parsed.edge === "left" ||
        parsed.edge === "right" ||
        parsed.edge === "top" ||
        parsed.edge === "bottom")
    ) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- localStorage 边界
      return { edge: (parsed as DockPersist).edge };
    }
  } catch {
    /* ignore */
  }
  return { edge: null };
}

function saveDock(edge: DockEdge | null): void {
  localStorage.setItem(DOCK_STORAGE_KEY, JSON.stringify({ edge } satisfies DockPersist));
}

async function readWindowRect(): Promise<RectPx | null> {
  try {
    const win = getCurrentWindow();
    const pos = await win.outerPosition();
    const size = await win.outerSize();
    const scale = await win.scaleFactor();
    return {
      x: pos.x / scale,
      y: pos.y / scale,
      width: size.width / scale,
      height: size.height / scale,
    };
  } catch {
    return null;
  }
}

async function readWorkArea(): Promise<RectPx | null> {
  try {
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- Tauri Monitor 模块解析边界
    const raw: unknown = (await currentMonitor()) ?? (await primaryMonitor());
    if (!isRecord(raw)) return null;
    const scale = typeof raw.scaleFactor === "number" ? raw.scaleFactor : null;
    const area = isRecord(raw.workArea) ? raw.workArea : null;
    const position = area && isRecord(area.position) ? area.position : null;
    const size = area && isRecord(area.size) ? area.size : null;
    if (
      scale == null ||
      scale <= 0 ||
      !position ||
      !size ||
      typeof position.x !== "number" ||
      typeof position.y !== "number" ||
      typeof size.width !== "number" ||
      typeof size.height !== "number"
    ) {
      return null;
    }
    return {
      x: position.x / scale,
      y: position.y / scale,
      width: size.width / scale,
      height: size.height / scale,
    };
  } catch {
    return null;
  }
}

async function applyFrame(frame: RectPx): Promise<void> {
  const current = await readWindowRect();
  if (current && framesClose(current, frame)) return;
  const win = getCurrentWindow();
  // 先定位再改尺寸，避免部分 WM 在 setSize 时按锚点把窗体往右/下推
  await win.setPosition(new LogicalPosition(frame.x, frame.y));
  await win.setSize(new LogicalSize(frame.width, frame.height));
}

export function PomodoroFloatApp() {
  const { kind: subjectKind } = useSubjectScope();
  const networkOnline = useNetworkOnline();
  const habitatConnection = useHabitatConnection();
  const [active, setActive] = useState<PomodoroActiveState | null>(() => readActive(subjectKind));
  const [, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dockedEdge, setDockedEdge] = useState<DockEdge | null>(() => loadDock().edge);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const leaveTimerRef = useRef<number | null>(null);
  const moveTimerRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  /** 用户拖拽过程中发生过移动；仅因此才在松手后贴边检测 */
  const userDragMovedRef = useRef(false);
  /** 程序化 setPosition/setSize 期间忽略 onMoved，避免反馈漂移 */
  const applyingFrameRef = useRef(false);
  const dockedEdgeRef = useRef(dockedEdge);
  dockedEdgeRef.current = dockedEdge;

  const showChrome = dockedEdge == null || hoverExpanded;

  useEffect(() => {
    void reconnectHabitat().catch(() => undefined);
  }, []);

  useEffect(() => {
    const refresh = () => setActive(readActive(subjectKind));
    const unsub = subscribePomodoroSync(() => refresh());
    const onCustom = (event: Event) => {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- DOM 事件目标边界
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
    return bindPomodoroShellActiveSync(subjectKind);
  }, [subjectKind]);

  useEffect(() => {
    if (!networkOnline || habitatConnection !== "connected") return;
    void pullPomodoroActive(subjectKind, { preferRemote: true }).then(() =>
      setActive(readActive(subjectKind)),
    );
  }, [networkOnline, habitatConnection, subjectKind]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void pullPomodoroActive(subjectKind, { preferRemote: true }).then(() =>
        setActive(readActive(subjectKind)),
      );
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [subjectKind]);

  useEffect(() => {
    const shell = window.portalShell;
    if (!shell?.listenConfigChanged) return () => {};
    return shell.listenConfigChanged(() => {
      void pullPomodoroActive(subjectKind, { preferRemote: true }).then(() =>
        setActive(readActive(subjectKind)),
      );
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

  const applyFrameGuarded = useCallback(async (frame: RectPx): Promise<void> => {
    applyingFrameRef.current = true;
    try {
      await applyFrame(frame);
    } finally {
      // 等 WM 事件排空后再允许 onMoved 处理
      window.setTimeout(() => {
        applyingFrameRef.current = false;
      }, MOVE_SETTLE_MS + 50);
    }
  }, []);

  const syncGeometry = useCallback(
    async (edge: DockEdge | null, expanded: boolean) => {
      const work = await readWorkArea();
      const win = await readWindowRect();
      if (!work || !win) return;
      if (edge == null) {
        if (win.width < 100 || win.height < 60) {
          await applyFrameGuarded({
            x: win.x,
            y: win.y,
            width: 220,
            height: 120,
          });
        }
        return;
      }
      if (expanded) {
        const collapsed = snapCollapsedFrame(edge, win, work);
        await applyFrameGuarded(snapExpandedNearEdge(edge, collapsed, work));
      } else {
        await applyFrameGuarded(snapCollapsedFrame(edge, win, work));
      }
    },
    [applyFrameGuarded],
  );

  useEffect(() => {
    void syncGeometry(dockedEdge, hoverExpanded);
  }, [dockedEdge, hoverExpanded, syncGeometry]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const runDockSettle = (): void => {
      const shouldSnap = userDragMovedRef.current;
      draggingRef.current = false;
      userDragMovedRef.current = false;
      if (!shouldSnap) return;
      void (async () => {
        const work = await readWorkArea();
        const win = await readWindowRect();
        if (!work || !win) return;
        const edge = detectDockEdge(win, work);
        if (edge) {
          setDockedEdge(edge);
          saveDock(edge);
          setHoverExpanded(false);
          await applyFrameGuarded(snapCollapsedFrame(edge, win, work));
        } else if (dockedEdgeRef.current != null) {
          setDockedEdge(null);
          saveDock(null);
          setHoverExpanded(false);
        }
      })();
    };

    const onPointerUp = (): void => {
      if (!draggingRef.current && !userDragMovedRef.current) return;
      if (moveTimerRef.current != null) window.clearTimeout(moveTimerRef.current);
      // 松手后再等一短拍，等 WM 把最终坐标写稳
      moveTimerRef.current = window.setTimeout(runDockSettle, MOVE_SETTLE_MS);
    };

    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    void getCurrentWindow()
      .onMoved(() => {
        if (applyingFrameRef.current) return;
        if (draggingRef.current) {
          userDragMovedRef.current = true;
          return;
        }
        // 非拖拽引起的移动忽略（程序化贴边 / 悬停展开）
      })
      .then((u) => {
        unlisten = u;
      });
    return () => {
      unlisten?.();
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      if (moveTimerRef.current != null) window.clearTimeout(moveTimerRef.current);
    };
  }, [applyFrameGuarded]);

  const onDragStart = useCallback((event: MouseEvent) => {
    if (event.button !== 0) return;
    draggingRef.current = true;
    userDragMovedRef.current = false;
    if (dockedEdgeRef.current != null) setHoverExpanded(true);
    void getCurrentWindow()
      .startDragging()
      .catch(() => {
        draggingRef.current = false;
        userDragMovedRef.current = false;
      });
  }, []);

  const onMouseEnter = useCallback(() => {
    if (leaveTimerRef.current != null) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    if (dockedEdgeRef.current != null) setHoverExpanded(true);
  }, []);

  const onMouseLeave = useCallback(() => {
    if (dockedEdgeRef.current == null) return;
    if (leaveTimerRef.current != null) window.clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = window.setTimeout(() => {
      setHoverExpanded(false);
      leaveTimerRef.current = null;
    }, HOVER_COLLAPSE_MS);
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

  const handleStart = useCallback(() => {
    if (busy) return;
    setBusy(true);
    void (async () => {
      try {
        const config = await fetchPomodoroConfig(subjectKind);
        await applyPomodoroActive(
          createInitialActiveState(config, { sessionLocalId: randomPublicId() }),
          subjectKind,
          { alertConfig: config },
        );
        setActive(readActive(subjectKind));
      } finally {
        setBusy(false);
      }
    })();
  }, [busy, subjectKind]);

  const handleEnd = useCallback(() => {
    if (!active || busy) return;
    setBusy(true);
    void runPhaseAbort({ state: active, subjectKind })
      .then(() => setActive(readActive(subjectKind)))
      .finally(() => setBusy(false));
  }, [active, busy, subjectKind]);

  const openFull = useCallback(() => {
    void window.portalShell?.openPomodoro?.();
  }, []);

  const rem = active ? pomodoroRemainingMs(active) : 0;
  const planned = active?.phasePlannedMs ?? 0;
  const ratio = active ? progressRatio(rem, planned) : 0;
  const verticalBar = dockedEdge === "left" || dockedEdge === "right";

  if (!showChrome) {
    return (
      <div
        className={`pomodoro-float pomodoro-float--collapsed${verticalBar ? " pomodoro-float--vertical" : ""}`}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onMouseDown={onDragStart}
      >
        <div className="pomodoro-float-bar-track" aria-hidden>
          <div
            className={`pomodoro-float-bar-fill${active ? "" : " pomodoro-float-bar-fill--idle"}`}
            style={verticalBar ? { height: `${ratio * 100}%` } : { width: `${ratio * 100}%` }}
          />
        </div>
      </div>
    );
  }

  const phaseText = active
    ? active.runState === "paused"
      ? `暂停 · ${pomodoroPhaseLabel(active.phase)}`
      : pomodoroPhaseLabel(active.phase)
    : "就绪";
  const pauseLabel = active?.runState === "paused" ? "继续" : "暂停";

  return (
    <div className="pomodoro-float" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <div className="pomodoro-float-top" onMouseDown={onDragStart}>
        <span className="pomodoro-float-phase">{phaseText}</span>
        <span className="pomodoro-float-clock">{active ? formatPomodoroClock(rem) : "--:--"}</span>
      </div>
      <div className="pomodoro-float-progress" aria-hidden>
        <div
          className={`pomodoro-float-progress-fill${active ? "" : " pomodoro-float-progress-fill--idle"}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <div className="pomodoro-float-actions">
        {!active ? (
          <button type="button" disabled={busy} onClick={handleStart}>
            开始
          </button>
        ) : (
          <>
            <button type="button" disabled={busy} onClick={togglePause}>
              {pauseLabel}
            </button>
            <button type="button" disabled={busy} onClick={handleEnd}>
              结束
            </button>
          </>
        )}
        <button type="button" onClick={openFull}>
          打开
        </button>
      </div>
    </div>
  );
}
