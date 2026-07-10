import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { requestAlertPermission } from "@freeanima/frontend/shell-sdk/alert";
import { switchWorkFocusTask } from "@freeanima/frontend/shell-sdk/pomodoro-focus-segments.ts";
import {
  clearPomodoroLaunchParamsFromUrl,
  getSubjectKind,
  readPomodoroLaunchParamsFromLocation,
} from "@freeanima/frontend/shell-sdk";
import {
  getPomodoroSyncSnapshot,
  subscribePomodoroSync,
} from "@freeanima/frontend/shell-sdk/pomodoro-sync-local.ts";
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
import { enqueuePomodoroConfigUpdate } from "./lib/pomodoro-offline-store.ts";
import {
  applyPomodoroActive,
  pullPomodoroActive,
  runPhaseAbort,
  runPhaseComplete,
} from "./lib/pomodoro-sync.ts";
import {
  createInitialActiveState,
  pauseActiveState,
  phaseLabel,
  remainingMs,
  resumeActiveState,
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
  const hubOnline = networkOnline && hubConnection === "connected";

  const [config, setConfig] = useState<PomodoroConfigRow | null>(null);
  const [active, setActive] = useState<PomodoroActiveState | null>(
    () => getPomodoroSyncSnapshot(getSubjectKind()).active,
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

  useEffect(() => {
    return subscribePomodoroSync((snapshot) => {
      setActive(snapshot.active);
      if (snapshot.active?.taskItemId != null) {
        setTaskItemId(snapshot.active.taskItemId);
      }
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const cfg = await fetchPomodoroConfig(subjectKind);
        if (cancelled) return;
        setConfig(cfg);
        await pullPomodoroActive(subjectKind);
        if (cancelled) return;
        setActive(getPomodoroSyncSnapshot(subjectKind).active);
        const restored = getPomodoroSyncSnapshot(subjectKind).active;
        if (restored?.taskItemId != null) setTaskItemId(restored.taskItemId);
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
  }, [subjectKind, reloadMeta]);

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
        void applyPomodoroActive(switchWorkFocusTask(active, launch.taskId), subjectKind);
      }
      clearPomodoroLaunchParamsFromUrl();
      return;
    }

    if (launch.autostart && launch.taskId != null && !autostartHandledRef.current) {
      autostartHandledRef.current = true;
      clearPomodoroLaunchParamsFromUrl();
      void applyPomodoroActive(
        createInitialActiveState(config, {
          taskItemId: launch.taskId,
          sessionLocalId: crypto.randomUUID(),
        }),
        subjectKind,
      );
    }
  }, [loading, config, active, subjectKind, navTick]);

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

  useEffect(() => {
    if (!active || active.runState !== "running" || !config) return;
    if (remainingMs(active) > 0) return;
    void (async () => {
      try {
        await runPhaseComplete({ state: active, config, subjectKind });
        await reloadMeta();
      } catch (e) {
        setError(String(e instanceof Error ? e.message : e));
      }
    })();
  }, [active, config, tick, subjectKind, reloadMeta]);

  const handleStart = () => {
    if (!config) return;
    void applyPomodoroActive(
      createInitialActiveState(config, {
        taskItemId,
        sessionLocalId: crypto.randomUUID(),
      }),
      subjectKind,
    );
  };

  const handlePauseResume = () => {
    if (!active) return;
    void applyPomodoroActive(
      active.runState === "paused" ? resumeActiveState(active) : pauseActiveState(active),
      subjectKind,
    );
  };

  const handleAbort = async () => {
    if (!active) return;
    try {
      await runPhaseAbort({ state: active, subjectKind });
      await reloadMeta();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  };

  const handleSkip = async () => {
    if (!active || !config) return;
    try {
      await runPhaseComplete({ state: active, config, subjectKind });
      await reloadMeta();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  };

  const handleConfigChange = async (patch: Partial<PomodoroConfigRow>) => {
    if (!config) return;
    if (!hubOnline) {
      await enqueuePomodoroConfigUpdate(subjectKind, patch);
      setConfig({ ...config, ...patch });
      return;
    }
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
                      void applyPomodoroActive(switchWorkFocusTask(active, null), subjectKind);
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
                  disabled={!hubOnline}
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
                  disabled={!hubOnline}
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
            void applyPomodoroActive(switchWorkFocusTask(active, nextId), subjectKind);
          }
        }}
      />
    </div>
  );
}
