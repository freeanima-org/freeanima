import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { requestAlertPermission } from "@freeanima/client/portal-sdk/alert";
import { usePortalRead } from "@freeanima/client/portal-sdk/portal-query";
import { switchWorkFocusLink } from "@freeanima/client/portal-sdk/pomodoro-focus-segments.ts";
import {
  clearPomodoroLaunchParamsFromUrl,
  readPomodoroLaunchParamsFromLocation,
} from "@freeanima/client/portal-sdk";
import {
  getPomodoroSyncSnapshot,
  subscribePomodoroSync,
} from "@freeanima/client/portal-sdk/pomodoro-sync-local.ts";
import {
  useHabitatConnection,
  useNetworkOnline,
  useUserSubjectId,
} from "@freeanima/client/portal-sdk/react.tsx";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  cn,
  Input,
  Spinner,
  Switch,
} from "@freeanima/ui-kit";
import { useCompactLayout } from "@freeanima/ui-kit/layout";
import { toast } from "@freeanima/ui-kit/composite";
import { formatDateTime } from "@freeanima/ui-kit/lib/datetime-local.ts";
import { pomodoroPhaseAccentCss } from "../../shared/phase-accent.ts";
import {
  AUTO_PERSIST_SHORT,
  createAutoPersistScheduler,
} from "@freeanima/ui-kit/lib/auto-persist-schedule.ts";
import { openEntityResource } from "@freeanima/client/portal-sdk/open-entity-resource.ts";

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
import { formatPomodoroLinkLabel, resolvePomodoroLinkLabel } from "./lib/task-picker-api.ts";
import { enqueuePomodoroConfigUpdate } from "./lib/pomodoro-offline-store.ts";
import { ensurePomodoroStart } from "./lib/ensure-pomodoro-start.ts";
import {
  applyPomodoroActive,
  pullPomodoroActive,
  runPhaseAbort,
  runPhaseComplete,
} from "./lib/pomodoro-sync.ts";
import { preferOnlineWrite } from "@freeanima/client/portal-sdk/prefer-online-write";
import { syncPomodoroPhaseLocalAlert } from "./lib/pomodoro-phase-alert.ts";
import {
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

function parseTaskIdFromLocation(): number | null {
  return readPomodoroLaunchParamsFromLocation().taskId;
}

function parseEventIdFromLocation(): number | null {
  return readPomodoroLaunchParamsFromLocation().eventId;
}

function formatDurationMs(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  return `${min} 分钟`;
}

function openTaskItemOverlay(taskItemId: number): void {
  void openEntityResource({
    id: taskItemId,
    component: "task_item",
    present: "overlay",
  });
}

function openCalendarEventOverlay(eventId: number): void {
  void openEntityResource({
    id: eventId,
    component: "calendar_event",
    present: "overlay",
  });
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
                {segments.map((segment) => {
                  const taskId = segment.task_item_id;
                  const eventId = segment.calendar_event_id;
                  return (
                    <li key={segment.id} className="flex flex-wrap items-center gap-1">
                      {taskId != null ? (
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() => openTaskItemOverlay(taskId)}
                        >
                          任务 #{taskId}
                        </button>
                      ) : eventId != null ? (
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() => openCalendarEventOverlay(eventId)}
                        >
                          事件 #{eventId}
                        </button>
                      ) : (
                        <span>未关联</span>
                      )}
                      <span>· {formatDurationMs(segment.duration_ms)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

type ConfigNumberFields = Pick<
  PomodoroConfigRow,
  "work_minutes" | "short_break_minutes" | "long_break_minutes" | "cycles_before_long_break"
>;

function numbersFromConfig(config: PomodoroConfigRow): ConfigNumberFields {
  return {
    work_minutes: config.work_minutes,
    short_break_minutes: config.short_break_minutes,
    long_break_minutes: config.long_break_minutes,
    cycles_before_long_break: config.cycles_before_long_break,
  };
}

export function PomodoroApp() {
  const compact = useCompactLayout();
  const subjectId = useUserSubjectId();
  const networkOnline = useNetworkOnline();
  const habitatConnection = useHabitatConnection();
  const habitatOnline = networkOnline && habitatConnection === "connected";

  const [config, setConfig] = useState<PomodoroConfigRow | null>(null);
  const configQuery = usePortalRead({
    queryKey: ["pomodoro", "config", subjectId],
    queryFn: () => {
      if (subjectId == null) throw new Error("subject_id not ready");
      return fetchPomodoroConfig(subjectId);
    },
    enabled: subjectId != null,
  });
  useEffect(() => {
    if (configQuery.data) setConfig(configQuery.data);
  }, [configQuery.data]);
  const [active, setActive] = useState<PomodoroActiveState | null>(null);
  useEffect(() => {
    if (subjectId == null) {
      setActive(null);
      return;
    }
    setActive(getPomodoroSyncSnapshot(subjectId).active);
  }, [subjectId]);
  const [tick, setTick] = useState(0);
  const [stats, setStats] = useState<PomodoroStats | null>(null);
  const [sessions, setSessions] = useState<PomodoroSessionRow[]>([]);
  const [focusBySessionId, setFocusBySessionId] = useState(
    () => new Map<number, PomodoroTaskFocusRow[]>(),
  );
  const [taskItemId, setTaskItemId] = useState<number | null>(parseTaskIdFromLocation());
  const [calendarEventId, setCalendarEventId] = useState<number | null>(parseEventIdFromLocation());
  const [linkedLabel, setLinkedLabel] = useState<string | null>(null);
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [configNumbers, setConfigNumbers] = useState<ConfigNumberFields | null>(null);
  const configRef = useRef(config);
  configRef.current = config;
  const configNumbersRef = useRef(configNumbers);
  configNumbersRef.current = configNumbers;
  const activeRef = useRef(active);
  activeRef.current = active;
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
    if (subjectId == null) return;
    const [s, list, focus] = await Promise.all([
      fetchPomodoroStats(subjectId, "today"),
      fetchPomodoroSessions(subjectId, { limit: 10 }),
      fetchPomodoroTaskFocus(subjectId, { limit: 100 }),
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
  }, [subjectId]);

  useEffect(() => {
    if (subjectId == null) return () => {};
    return subscribePomodoroSync(() => {
      const snapshot = getPomodoroSyncSnapshot(subjectId);
      setActive(snapshot.active);
      if (snapshot.active?.taskItemId != null) {
        setTaskItemId(snapshot.active.taskItemId);
        setCalendarEventId(null);
      } else if (snapshot.active?.calendarEventId != null) {
        setCalendarEventId(snapshot.active.calendarEventId);
        setTaskItemId(null);
      }
    });
  }, [subjectId]);

  useEffect(() => {
    if (!habitatOnline) return;
    void pullPomodoroActive(subjectId).then(() => {
      setActive(getPomodoroSyncSnapshot(subjectId).active);
    });
  }, [habitatOnline, subjectId]);

  const reloadConfig = configQuery.reload;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        await reloadConfig();
        if (cancelled) return;
        await pullPomodoroActive(subjectId);
        if (cancelled) return;
        setActive(getPomodoroSyncSnapshot(subjectId).active);
        const restored = getPomodoroSyncSnapshot(subjectId).active;
        if (restored?.taskItemId != null) {
          setTaskItemId(restored.taskItemId);
          setCalendarEventId(null);
        } else if (restored?.calendarEventId != null) {
          setCalendarEventId(restored.calendarEventId);
          setTaskItemId(null);
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
  }, [subjectId, reloadMeta, reloadConfig]);

  useEffect(() => {
    autostartHandledRef.current = false;
  }, [subjectId]);

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
    if (launch.taskId == null && launch.eventId == null && !launch.autostart) return;

    if (launch.taskId != null) {
      setTaskItemId(launch.taskId);
      setCalendarEventId(null);
      void resolvePomodoroLinkLabel({ taskItemId: launch.taskId }).then(setLinkedLabel);
    } else if (launch.eventId != null) {
      setCalendarEventId(launch.eventId);
      setTaskItemId(null);
      void resolvePomodoroLinkLabel({ calendarEventId: launch.eventId }).then(setLinkedLabel);
    }

    if (active) {
      if (launch.taskId != null && active.taskItemId !== launch.taskId) {
        void applyPomodoroActive(
          switchWorkFocusLink(active, { taskItemId: launch.taskId, calendarEventId: null }),
          subjectId,
        );
      } else if (launch.eventId != null && active.calendarEventId !== launch.eventId) {
        void applyPomodoroActive(
          switchWorkFocusLink(active, { taskItemId: null, calendarEventId: launch.eventId }),
          subjectId,
        );
      }
      clearPomodoroLaunchParamsFromUrl();
      return;
    }

    if (launch.autostart && !autostartHandledRef.current) {
      autostartHandledRef.current = true;
      clearPomodoroLaunchParamsFromUrl();
      void (async () => {
        const result = await ensurePomodoroStart({
          subjectId,
          config,
          taskItemId: launch.taskId ?? null,
          calendarEventId: launch.eventId ?? null,
        });
        if (result === "adopted_remote") {
          toast("已在其他设备进行中，已同步进度", { duration: 3000 });
        }
        setActive(getPomodoroSyncSnapshot(subjectId).active);
      })();
    }
  }, [loading, config, active, subjectId, navTick]);

  useEffect(() => {
    if (taskItemId == null && calendarEventId == null) {
      setLinkedLabel(null);
      return () => {};
    }
    let cancelled = false;
    void resolvePomodoroLinkLabel({ taskItemId, calendarEventId }).then((title) => {
      if (!cancelled) setLinkedLabel(title);
    });
    return () => {
      cancelled = true;
    };
  }, [taskItemId, calendarEventId]);

  useEffect(() => {
    if (!active || active.runState !== "running") return () => {};
    const id = window.setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (!active || active.runState !== "running" || !config || subjectId == null) return;
    if (remainingMs(active) > 0) return;
    void (async () => {
      try {
        await runPhaseComplete({ state: active, config, subjectId });
        await reloadMeta();
      } catch (e) {
        setError(String(e instanceof Error ? e.message : e));
      }
    })();
  }, [active, config, tick, subjectId, reloadMeta]);

  const handleStart = () => {
    if (!config || subjectId == null) return;
    void (async () => {
      const result = await ensurePomodoroStart({
        subjectId,
        config,
        taskItemId,
        calendarEventId,
      });
      if (result === "adopted_remote") {
        toast("已在其他设备进行中，已同步进度", { duration: 3000 });
      }
      setActive(getPomodoroSyncSnapshot(subjectId).active);
    })();
  };

  const handlePauseResume = () => {
    if (!active || subjectId == null) return;
    void applyPomodoroActive(
      active.runState === "paused" ? resumeActiveState(active) : pauseActiveState(active),
      subjectId,
      config ? { alertConfig: config } : undefined,
    );
  };

  const handleAbort = async () => {
    if (!active) return;
    try {
      await runPhaseAbort({ state: active, subjectId });
      await reloadMeta();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  };

  const handleSkip = async () => {
    if (!active || !config) return;
    try {
      await runPhaseComplete({ state: active, config, subjectId });
      await reloadMeta();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  };

  const handleConfigChange = useCallback(
    async (patch: Partial<PomodoroConfigRow>) => {
      const current = configRef.current;
      if (!current) return;
      try {
        const next = await preferOnlineWrite(
          async () => updatePomodoroConfig(subjectId, patch),
          async () => {
            await enqueuePomodoroConfigUpdate(subjectId, patch);
            return { ...current, ...patch };
          },
        );
        setConfig(next);
        const currentActive = activeRef.current;
        if (currentActive) await syncPomodoroPhaseLocalAlert(currentActive, currentActive, next);
      } catch (e) {
        setError(String(e instanceof Error ? e.message : e));
      }
    },
    [subjectId],
  );

  const handleConfigChangeRef = useRef(handleConfigChange);
  handleConfigChangeRef.current = handleConfigChange;

  const configNumberScheduler = useMemo(
    () =>
      createAutoPersistScheduler({
        ...AUTO_PERSIST_SHORT,
        onFire: () => {
          const n = configNumbersRef.current;
          if (!n) return;
          void handleConfigChangeRef.current(n);
        },
      }),
    [],
  );

  useEffect(() => () => configNumberScheduler.flush(), [configNumberScheduler]);

  useEffect(() => {
    if (!config) {
      setConfigNumbers(null);
      return;
    }
    if (configNumberScheduler.isPending()) return;
    setConfigNumbers(numbersFromConfig(config));
  }, [config, configNumberScheduler]);

  useEffect(() => {
    if (!showSettings) configNumberScheduler.flush();
  }, [showSettings, configNumberScheduler]);

  const patchConfigNumber = <K extends keyof ConfigNumberFields>(
    key: K,
    value: ConfigNumberFields[K],
  ) => {
    const base = configNumbersRef.current ?? (config ? numbersFromConfig(config) : null);
    if (!base) return;
    const next = { ...base, [key]: value };
    configNumbersRef.current = next;
    setConfigNumbers(next);
    configNumberScheduler.schedule();
  };

  const canPickTaskWhileActive = active?.phase === "work";

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const historySection = (
    <div className={cn("flex min-h-0 flex-col", !compact && "h-full overflow-hidden")}>
      <h2 className="mb-2 shrink-0 text-sm font-medium">专注历史</h2>
      <div className={cn(compact ? undefined : "min-h-0 flex-1 overflow-y-auto")}>
        <SessionHistory items={sessions} focusBySessionId={focusBySessionId} />
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        "mx-auto flex h-full min-h-0 w-full flex-col gap-4 p-4",
        compact ? "max-w-lg overflow-y-auto" : "max-w-5xl",
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">番茄钟</h1>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div
        className={cn(
          "min-h-0 flex-1",
          compact ? "flex flex-col gap-4" : "grid grid-cols-2 gap-6 overflow-hidden",
        )}
      >
        <div className={cn("flex flex-col gap-4", !compact && "min-h-0 overflow-y-auto")}>
          <Card>
            <CardContent className="flex flex-col items-center gap-4 pt-6">
              <div
                className={cn(
                  "relative flex h-48 w-48 items-center justify-center rounded-full border-4",
                  !active && "border-primary/30",
                )}
                style={
                  active
                    ? {
                        borderColor: `color-mix(in srgb, ${pomodoroPhaseAccentCss(active.phase)} 30%, transparent)`,
                        background: `conic-gradient(${pomodoroPhaseAccentCss(active.phase)} ${progress * 360}deg, transparent 0)`,
                      }
                    : {
                        background: `conic-gradient(hsl(var(--primary)) ${progress * 360}deg, transparent 0)`,
                      }
                }
              >
                <div className="bg-background flex h-40 w-40 flex-col items-center justify-center rounded-full">
                  <span
                    className={cn("text-sm", !active && "text-muted-foreground")}
                    style={active ? { color: pomodoroPhaseAccentCss(active.phase) } : undefined}
                  >
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
                  <Button type="button" onClick={handleStart} isDisabled={!config}>
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
                <span className="text-muted-foreground block text-xs">关联（可选）</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-w-0 flex-1 justify-start"
                    isDisabled={
                      Boolean(active) &&
                      !canPickTaskWhileActive &&
                      taskItemId == null &&
                      calendarEventId == null
                    }
                    onClick={() => {
                      if (taskItemId != null) {
                        openTaskItemOverlay(taskItemId);
                        return;
                      }
                      if (calendarEventId != null) {
                        openCalendarEventOverlay(calendarEventId);
                        return;
                      }
                      if (!active || canPickTaskWhileActive) setTaskPickerOpen(true);
                    }}
                  >
                    <span className="truncate">
                      {linkedLabel ??
                        (taskItemId != null
                          ? `任务 #${taskItemId}`
                          : calendarEventId != null
                            ? `事件 #${calendarEventId}`
                            : "点击选择任务或事件")}
                    </span>
                  </Button>
                  {(taskItemId != null || calendarEventId != null) &&
                  (!active || canPickTaskWhileActive) ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setTaskPickerOpen(true)}
                    >
                      更换
                    </Button>
                  ) : null}
                  {(taskItemId != null || calendarEventId != null) &&
                  (!active || canPickTaskWhileActive) ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setTaskItemId(null);
                        setCalendarEventId(null);
                        setLinkedLabel(null);
                        if (active && canPickTaskWhileActive) {
                          void applyPomodoroActive(
                            switchWorkFocusLink(active, {
                              taskItemId: null,
                              calendarEventId: null,
                            }),
                            subjectId,
                          );
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
                      value={(configNumbers ?? numbersFromConfig(config))[key]}
                      disabled={!habitatOnline}
                      onChange={(e) => patchConfigNumber(key, Number(e.target.value))}
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
                      isSelected={config[key]}
                      isDisabled={!habitatOnline}
                      onChange={(checked) => void handleConfigChange({ [key]: checked })}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {compact ? historySection : null}
        </div>

        {!compact ? historySection : null}
      </div>

      <TaskPickerDialog
        open={taskPickerOpen}
        selectedTaskId={taskItemId}
        selectedEventId={calendarEventId}
        onClose={() => setTaskPickerOpen(false)}
        onSelect={(link) => {
          const nextTaskId = link?.kind === "task" ? link.id : null;
          const nextEventId = link?.kind === "event" ? link.id : null;
          setTaskItemId(nextTaskId);
          setCalendarEventId(nextEventId);
          setLinkedLabel(link ? formatPomodoroLinkLabel(link) : null);
          if (active && canPickTaskWhileActive) {
            void applyPomodoroActive(
              switchWorkFocusLink(active, {
                taskItemId: nextTaskId,
                calendarEventId: nextEventId,
              }),
              subjectId,
            );
          }
        }}
      />
    </div>
  );
}
