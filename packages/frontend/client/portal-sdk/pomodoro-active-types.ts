export type PomodoroPhase = "work" | "short_break" | "long_break";

export type TimerRunState = "idle" | "running" | "paused";

/** 本机 ephemeral 番茄钟活跃状态（localStorage） */
export type PomodoroFocusSegmentDraft = {
  task_item_id: number | null;
  calendar_event_id: number | null;
  started_at: string;
  ended_at: string | null;
};

/** 关联目标：任务与日历事件互斥 */
export type PomodoroFocusLink = {
  taskItemId: number | null;
  calendarEventId: number | null;
};

export type PomodoroActiveState = {
  phase: PomodoroPhase;
  runState: TimerRunState;
  phasePlannedMs: number;
  phaseEndsAt: number | null;
  pausedRemainingMs: number | null;
  cycleIndex: number;
  completedWorkInCycle: number;
  taskItemId: number | null;
  calendarEventId: number | null;
  sessionLocalId: string;
  phaseStartedAt: string;
  /** 专注阶段内的任务时间段（仅 work 阶段有效） */
  focusSegments: PomodoroFocusSegmentDraft[];
};
