import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deliverAlert, requestAlertPermission } from "@freeanima/frontend/shell-sdk/alert";
import {
  buildTaskFocusSegmentPayloads,
  primaryTaskItemIdFromSegments,
  switchWorkFocusTask,
} from "@freeanima/frontend/shell-sdk/pomodoro-focus-segments.ts";
import {
  clearPomodoroLaunchParamsFromUrl,
  getSubjectKind,
  readPomodoroActiveState,
  readPomodoroLaunchParamsFromLocation,
  writePomodoroActiveState,
} from "@freeanima/frontend/shell-sdk";
import {
  useHubConnection,
  useNetworkOnline,
  useSubjectScope,
  SubjectScopeToggle,
} from "@freeanima/frontend/shell-sdk/react.tsx";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Input,
  Spinner,
  Switch,
} from "@freeanima/frontend/ui-kit";

import { TaskPickerDialog } from "./components/TaskPickerDialog.tsx";
import {
  abortPomodoroSession,
  completePomodoroSession,
  fetchPomodoroConfig,
  fetchPomodoroSessions,
  fetchPomodoroStats,
  fetchPomodoroTaskFocus,
  updatePomodoroConfig,
  type PomodoroConfigRow,
  type PomodoroSessionRow,
  type PomodoroStats,
  type PomodoroTaskFocusRow,
} from "./lib/api.ts";
import { resolveTaskTitleForPicker } from "./lib/task-picker-api.ts";
import {
  actualDurationMs,
  createInitialActiveState,
  nextPhaseAfterComplete,
  pauseActiveState,
  phaseCompletionKey,
  phaseLabel,
  remainingMs,
  resumeActiveState,
  shouldAutoStartNext,
  startPhaseState,
  type PomodoroActiveState,
} from "./lib/timer-engine.ts";

function formatClock(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function parseTaskIdFromLocation(): number | null {
  return readPomodoroLaunchParamsFromLocation().taskId;
}

function formatDurationMs(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  return `${min} 分钟`;
}

function SessionHistory({
  items,
  focusBySessionId,
}: {
  items: PomodoroSessionRow[];
  focusBySessionId: Map<number, PomodoroTaskFocusRow[]>;
}) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">暂无记录</p>;
  }
  return (
    <ul className="space-y-2 text-sm">
      {items.map((item) => {
        const segments = item.phase === "work" ? (focusBySessionId.get(item.id) ?? []) : [];
        return (
          <li key={item.id} className="border rounded-md px-3 py-2">
            <div className="font-medium">{item.title}</div>
            <div className="text-muted-foreground text-xs">
              {phaseLabel(item.phase)} · {formatDateTime(item.started_at)}
              {item.interrupted ? " · 已中断" : ""}
            </div>
            {segments.length > 0 ? (
              <ul className="text-muted-foreground mt-1 space-y-0.5 text-xs">
                {segments.map((segment) => (
                  <li key={segment.id}>
                    任务 #{segment.task_item_id ?? "—"} · {formatDurationMs(segment.duration_ms)}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function PomodoroApp() {
  const { kind: subjectKind } = useSubjectScope();
  const networkOnline = useNetworkOnline();
  const hubConnection = useHubConnection();
  const writesDisabled = !networkOnline || hubConnection !== "connected";

  const [config, setConfig] = useState<PomodoroConfigRow | null>(null);
  const [active, setActive] = useState<PomodoroActiveState | null>(() =>
    readPomodoroActiveState(undefined, getSubjectKind()),
  );
  const [tick, setTick] = useState(0);
  const [stats, setStats] = useState<PomodoroStats | null>(null);
  const [sessions, setSessions] = useState<PomodoroSessionRow[]>([]);
  const [focusBySessionId, setFocusBySessionId] = useState(
    () => new Map<number, PomodoroTaskFocusRow[]>(),
  );
  const [taskItemId, setTaskItemId] = useState<number | null>(parseTaskIdFromLocation());
  const [linkedTaskTitle, setLinkedTaskTitle] = useState<string | null>(null);
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const phaseHandledRef = useRef<string | null>(null);
  const autostartHandledRef = useRef(false);
  const [navTick, setNavTick] = useState(0);

  const displayRemaining = useMemo(() => {
    if (!active) return 0;
    void tick;
    return remainingMs(active);
  }, [active, tick]);

  const progress = useMemo(() => {
    if (!active || active.phasePlannedMs <= 0) return 0;
    return Math.min(1, 1 - displayRemaining / active.phasePlannedMs);
  }, [active, displayRemaining]);

  const reloadMeta = useCallback(async () => {
    const [s, list, focus] = await Promise.all([
      fetchPomodoroStats(subjectKind, "today"),
      fetchPomodoroSessions(subjectKind, { limit: 10 }),
      fetchPomodoroTaskFocus(subjectKind, { limit: 100 }),
    ]);
    setStats(s);
    setSessions(list.items);
    const map = new Map<number, PomodoroTaskFocusRow[]>();
    for (const segment of focus.items) {
      if (segment.pomodoro_session_id == null) continue;
      const bucket = map.get(segment.pomodoro_session_id) ?? [];
      bucket.push(segment);
      map.set(segment.pomodoro_session_id, bucket);
    }
    setFocusBySessionId(map);
  }, [subjectKind]);

  const applyActive = useCallback(
    (next: PomodoroActiveState | null) => {
      setActive(next);
      writePomodoroActiveState(next, undefined, subjectKind);
      if (next?.taskItemId != null) {
        setTaskItemId(next.taskItemId);
      }
    },
    [subjectKind],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const cfg = await fetchPomodoroConfig(subjectKind);
        if (cancelled) return;
        setConfig(cfg);
        const restored = readPomodoroActiveState(undefined, subjectKind);
        if (restored) {
          setActive(restored);
          if (restored.taskItemId != null) setTaskItemId(restored.taskItemId);
        }
        await reloadMeta();
        void requestAlertPermission();
      } catch (e) {
        if (!cancelled) setError(String(e instanceof Error ? e.message : e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subjectKind, reloadMeta, applyActive]);

  useEffect(() => {
    autostartHandledRef.current = false;
  }, [subjectKind]);

  useEffect(() => {
    const bump = () => setNavTick((n) => n + 1);
    window.addEventListener("hashchange", bump);
    window.addEventListener("popstate", bump);
    return () => {
      window.removeEventListener("hashchange", bump);
      window.removeEventListener("popstate", bump);
    };
  }, []);

  useEffect(() => {
    if (loading || !config) return;
    void navTick;
    const launch = readPomodoroLaunchParamsFromLocation();
    if (launch.taskId == null && !launch.autostart) return;

    if (launch.taskId != null) {
      setTaskItemId(launch.taskId);
      void resolveTaskTitleForPicker(launch.taskId).then(setLinkedTaskTitle);
    }

    if (active) {
      if (launch.taskId != null && active.taskItemId !== launch.taskId) {
        applyActive(switchWorkFocusTask(active, launch.taskId));
      }
      clearPomodoroLaunchParamsFromUrl();
      return;
    }

    if (launch.autostart && launch.taskId != null && !autostartHandledRef.current) {
      autostartHandledRef.current = true;
      clearPomodoroLaunchParamsFromUrl();
      phaseHandledRef.current = null;
      applyActive(
        createInitialActiveState(config, {
          taskItemId: launch.taskId,
          sessionLocalId: crypto.randomUUID(),
        }),
      );
    }
  }, [loading, config, active, applyActive, navTick]);

  useEffect(() => {
    if (taskItemId == null) {
      setLinkedTaskTitle(null);
      return;
    }
    let cancelled = false;
    void resolveTaskTitleForPicker(taskItemId).then((title) => {
      if (!cancelled) setLinkedTaskTitle(title);
    });
    return () => {
      cancelled = true;
    };
  }, [taskItemId]);

  useEffect(() => {
    if (!active || active.runState !== "running") return;
    const id = window.setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [active]);

  const persistPhaseEnd = useCallback(
    async (state: PomodoroActiveState, interrupted: boolean) => {
      if (!config) return;
      const finishedAt = new Date().toISOString();
      const actual = actualDurationMs(state, Date.now());
      const segments = buildTaskFocusSegmentPayloads(state, Date.now());
      const payload = {
        phase: state.phase,
        started_at: state.phaseStartedAt,
        finished_at: finishedAt,
        planned_duration_ms: state.phasePlannedMs,
        actual_duration_ms: actual,
        task_item_id: primaryTaskItemIdFromSegments(segments) ?? state.taskItemId,
        cycle_index: state.cycleIndex,
        session_local_id: state.sessionLocalId,
        ...(segments.length > 0 ? { task_focus_segments: segments } : {}),
      };
      if (interrupted) {
        await abortPomodoroSession(subjectKind, payload);
      } else {
        await completePomodoroSession(subjectKind, payload);
      }
      await reloadMeta();
    },
    [config, subjectKind, reloadMeta],
  );

  const handlePhaseComplete = useCallback(
    async (state: PomodoroActiveState) => {
      if (!config) return;
      const key = phaseCompletionKey(state);
      if (phaseHandledRef.current === key) return;
      phaseHandledRef.current = key;

      const transition = nextPhaseAfterComplete(config, state.phase, state.completedWorkInCycle);
      const autoStart = shouldAutoStartNext(config, state.phase);
      // 先切换/清空活动态（与 handleAbort 一致），避免原 phaseEndsAt 到期再次落库
      if (!autoStart) {
        applyActive(null);
      } else {
        applyActive(
          startPhaseState(
            config,
            state,
            transition.nextPhase,
            transition.cycleIndex,
            transition.completedWorkInCycle,
          ),
        );
      }

      try {
        await persistPhaseEnd(state, false);
      } catch (e) {
        setError(String(e instanceof Error ? e.message : e));
        return;
      }

      if (config.notify_on_phase_end || config.sound_enabled) {
        void deliverAlert(
          {
            title: `${phaseLabel(state.phase)}结束`,
            body: state.phase === "work" ? "休息一下" : "准备下一轮专注",
            tag: `pomodoro:${state.sessionLocalId}:${state.phase}`,
            sound: config.sound_enabled,
            silent: !config.notify_on_phase_end,
          },
          { sourceRoute: "/pomodoro", suppressOsWhenFocused: true },
        );
      }
    },
    [config, persistPhaseEnd, applyActive],
  );

  useEffect(() => {
    if (!active || active.runState !== "running" || !config) return;
    if (remainingMs(active) > 0) return;
    void handlePhaseComplete(active);
  }, [active, config, tick, handlePhaseComplete]);

  const handleStart = () => {
    if (!config) return;
    phaseHandledRef.current = null;
    applyActive(
      createInitialActiveState(config, {
        taskItemId,
        sessionLocalId: crypto.randomUUID(),
      }),
    );
  };

  const handlePauseResume = () => {
    if (!active) return;
    applyActive(
      active.runState === "paused" ? resumeActiveState(active) : pauseActiveState(active),
    );
  };

  const handleAbort = async () => {
    if (!active) return;
    const snapshot = active;
    applyActive(null);
    if (!writesDisabled) {
      try {
        await persistPhaseEnd(snapshot, true);
      } catch (e) {
        setError(String(e instanceof Error ? e.message : e));
      }
    }
  };

  const handleSkip = async () => {
    if (!active) return;
    await handlePhaseComplete(active);
  };

  const handleConfigChange = async (patch: Partial<PomodoroConfigRow>) => {
    if (!config || writesDisabled) return;
    try {
      const next = await updatePomodoroConfig(subjectKind, patch);
      setConfig(next);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  };

  const canPickTaskWhileActive = active?.phase === "work";

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">番茄钟</h1>
        <SubjectScopeToggle />
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="flex flex-col items-center gap-4 pt-6">
          <div
            className="relative flex h-48 w-48 items-center justify-center rounded-full border-4 border-primary/30"
            style={{
              background: `conic-gradient(hsl(var(--primary)) ${progress * 360}deg, transparent 0)`,
            }}
          >
            <div className="bg-background flex h-40 w-40 flex-col items-center justify-center rounded-full">
              <span className="text-muted-foreground text-sm">
                {active ? phaseLabel(active.phase) : "就绪"}
              </span>
              <span className="font-mono text-4xl tabular-nums">
                {active
                  ? formatClock(displayRemaining)
                  : formatClock((config?.work_minutes ?? 25) * 60_000)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {!active ? (
              <Button type="button" onClick={handleStart} disabled={!config}>
                开始
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={handlePauseResume}>
                  {active.runState === "paused" ? "继续" : "暂停"}
                </Button>
                <Button type="button" variant="outline" onClick={() => void handleSkip()}>
                  跳过
                </Button>
                <Button type="button" variant="ghost" onClick={() => void handleAbort()}>
                  放弃
                </Button>
              </>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings((v) => !v)}
            >
              设置
            </Button>
          </div>

          <div className="w-full space-y-2">
            <span className="text-muted-foreground block text-xs">关联任务（可选）</span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-w-0 flex-1 justify-start"
                disabled={Boolean(active) && !canPickTaskWhileActive}
                onClick={() => setTaskPickerOpen(true)}
              >
                <span className="truncate">
                  {linkedTaskTitle ?? (taskItemId != null ? `任务 #${taskItemId}` : "点击选择任务")}
                </span>
              </Button>
              {taskItemId != null && (!active || canPickTaskWhileActive) ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTaskItemId(null);
                    setLinkedTaskTitle(null);
                    if (active && canPickTaskWhileActive) {
                      applyActive(switchWorkFocusTask(active, null));
                    }
                  }}
                >
                  清除
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {stats ? (
        <p className="text-muted-foreground text-center text-sm">
          今日 {stats.completed_work_sessions} 个番茄 · {stats.total_focus_minutes} 分钟专注
        </p>
      ) : null}

      {showSettings && config ? (
        <Card>
          <CardContent className="space-y-3 pt-4 text-sm">
            {(
              [
                ["work_minutes", "专注（分钟）"],
                ["short_break_minutes", "短休（分钟）"],
                ["long_break_minutes", "长休（分钟）"],
                ["cycles_before_long_break", "长休前番茄数"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-2">
                <span>{label}</span>
                <Input
                  className="w-24"
                  type="number"
                  value={config[key]}
                  disabled={writesDisabled}
                  onChange={(e) => void handleConfigChange({ [key]: Number(e.target.value) })}
                />
              </div>
            ))}
            {(
              [
                ["auto_start_break", "自动开始休息"],
                ["auto_start_work", "自动开始专注"],
                ["notify_on_phase_end", "阶段结束系统通知"],
                ["sound_enabled", "提示音"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-2">
                <span>{label}</span>
                <Switch
                  checked={config[key]}
                  disabled={writesDisabled}
                  onCheckedChange={(checked) => void handleConfigChange({ [key]: checked })}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div>
        <h2 className="mb-2 text-sm font-medium">最近记录</h2>
        <SessionHistory items={sessions} focusBySessionId={focusBySessionId} />
      </div>

      <TaskPickerDialog
        open={taskPickerOpen}
        selectedId={taskItemId}
        onClose={() => setTaskPickerOpen(false)}
        onSelect={(task) => {
          const nextId = task?.id ?? null;
          setTaskItemId(nextId);
          setLinkedTaskTitle(task?.title ?? null);
          if (active && canPickTaskWhileActive) {
            applyActive(switchWorkFocusTask(active, nextId));
          }
        }}
      />
    </div>
  );
}
