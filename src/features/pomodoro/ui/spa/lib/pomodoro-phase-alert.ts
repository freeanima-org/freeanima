import { cancelScheduledAlert, scheduleLocalAlert } from "@freeanima/client/portal-sdk/alert";
import { isCompanionReminderPreferred } from "@freeanima/client/portal-sdk/local-reminder.ts";
import type { PomodoroActiveState } from "@freeanima/client/portal-sdk/pomodoro-active-types.ts";

import type { PomodoroConfigRow } from "./api.ts";
import { phaseLabel } from "./timer-engine.ts";

/** 成功预登记过的 phase tag（用于 complete 时避免双弹）。 */
const scheduledPhaseTags = new Set<string>();

export function pomodoroPhaseAlertTag(state: PomodoroActiveState): string {
  return `pomodoro:${state.sessionLocalId}:${state.phase}`;
}

export function wasPomodoroPhaseAlertScheduled(tag: string): boolean {
  return scheduledPhaseTags.has(tag);
}

export function clearPomodoroPhaseAlertScheduleTrackingForTest(): void {
  scheduledPhaseTags.clear();
}

function shouldNotify(config: PomodoroConfigRow): boolean {
  return config.notify_on_phase_end || config.sound_enabled;
}

function phaseAlertPayload(state: PomodoroActiveState, config: PomodoroConfigRow) {
  return {
    title: `${phaseLabel(state.phase)}结束`,
    body: state.phase === "work" ? "休息一下" : "准备下一轮专注",
    tag: pomodoroPhaseAlertTag(state),
    sound: config.sound_enabled,
    silent: !config.notify_on_phase_end,
  };
}

export async function cancelPomodoroPhaseAlert(state: PomodoroActiveState): Promise<void> {
  const tag = pomodoroPhaseAlertTag(state);
  await cancelScheduledAlert({ tag });
  scheduledPhaseTags.delete(tag);
}

/**
 * 按 active 状态同步本机预登记：running+phaseEndsAt → schedule；否则 cancel。
 * companion 可见时不 schedule（OS 定时器无法走气泡；即时路径由 deliverLocalReminder 气泡）。
 * `config` 为 null 时只 cancel、不 schedule。
 */
export async function syncPomodoroPhaseLocalAlert(
  prev: PomodoroActiveState | null,
  next: PomodoroActiveState | null,
  config: PomodoroConfigRow | null,
): Promise<void> {
  if (prev && (!next || prev.sessionLocalId !== next.sessionLocalId || prev.phase !== next.phase)) {
    await cancelPomodoroPhaseAlert(prev);
  }

  if (!next) {
    if (prev) await cancelPomodoroPhaseAlert(prev);
    return;
  }

  if (next.runState !== "running" || next.phaseEndsAt == null) {
    await cancelPomodoroPhaseAlert(next);
    return;
  }

  if (!config || !shouldNotify(config)) {
    await cancelPomodoroPhaseAlert(next);
    return;
  }

  if (await isCompanionReminderPreferred()) {
    await cancelPomodoroPhaseAlert(next);
    return;
  }

  const payload = phaseAlertPayload(next, config);
  const result = await scheduleLocalAlert(payload, new Date(next.phaseEndsAt));
  if (result) scheduledPhaseTags.add(payload.tag);
  else scheduledPhaseTags.delete(payload.tag);
}
