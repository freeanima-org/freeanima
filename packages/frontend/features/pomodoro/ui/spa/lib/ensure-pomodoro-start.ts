import { getHabitatRpcConnectionState } from "@freeanima/client/portal-sdk/habitat-connection.ts";
import { getPomodoroSyncSnapshot } from "@freeanima/client/portal-sdk/pomodoro-sync-local.ts";
import { readPomodoroActiveState } from "@freeanima/client/portal-sdk/pomodoro-active.ts";
import type { PomodoroActiveState } from "@freeanima/client/portal-sdk/pomodoro-active-types.ts";
import { randomPublicId } from "@freeanima/shared/util";

import type { PomodoroConfigRow } from "./api.ts";
import { applyPomodoroActive, pullPomodoroActive } from "./pomodoro-sync.ts";
import { createInitialActiveState } from "./timer-engine.ts";

export type PomodoroStartResult = "started" | "adopted_remote" | "blocked";

export type EnsurePomodoroStartOpts = {
  subjectId: number;
  config: PomodoroConfigRow;
  taskItemId?: number | null;
  calendarEventId?: number | null;
  habitId?: number | null;
  sessionLocalId?: string;
};

function hubReady(): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;
  return getHabitatRpcConnectionState() === "connected";
}

function readActive(subjectId: number): PomodoroActiveState | null {
  return getPomodoroSyncSnapshot(subjectId).active ?? readPomodoroActiveState(undefined, subjectId);
}

function isLiveSession(state: PomodoroActiveState): boolean {
  return state.runState === "running" || state.runState === "paused";
}

/** 开始前 pull 远端；Hub 已有 active 则 adopt，不新建会话。 */
export async function ensurePomodoroStart(
  opts: EnsurePomodoroStartOpts,
): Promise<PomodoroStartResult> {
  const { subjectId, config } = opts;
  if (subjectId <= 0) return "blocked";

  const localExisting = readActive(subjectId);
  if (localExisting && isLiveSession(localExisting)) {
    return "adopted_remote";
  }

  if (hubReady()) {
    await pullPomodoroActive(subjectId, { preferRemote: true });
    const remoteExisting = readActive(subjectId);
    if (remoteExisting && isLiveSession(remoteExisting)) {
      return "adopted_remote";
    }
  }

  await applyPomodoroActive(
    createInitialActiveState(config, {
      taskItemId: opts.taskItemId ?? null,
      calendarEventId: opts.calendarEventId ?? null,
      habitId: opts.habitId ?? null,
      sessionLocalId: opts.sessionLocalId ?? randomPublicId(),
    }),
    subjectId,
    { alertConfig: config },
  );
  return "started";
}
