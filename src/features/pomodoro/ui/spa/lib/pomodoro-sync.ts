import { deliverAlert } from "@freeanima/frontend/shell-sdk/alert";
import type { PomodoroActiveState } from "@freeanima/frontend/shell-sdk/pomodoro-active-types.ts";
import {
  applyLocalPomodoroActive,
  buildHubActivePayload,
  getPomodoroSyncMeta,
  mergeRemoteActive,
} from "@freeanima/frontend/shell-sdk/pomodoro-sync-local.ts";
import { readPomodoroActiveState } from "@freeanima/frontend/shell-sdk/pomodoro-active.ts";

import {
  abortPomodoroSession,
  clearPomodoroActiveRemote,
  completePomodoroSession,
  fetchPomodoroActive,
  putPomodoroActiveRemote,
  type PomodoroConfigRow,
  type PomodoroSubjectKind,
} from "./api.ts";
import {
  enqueuePomodoroSessionAbort,
  enqueuePomodoroSessionComplete,
} from "./pomodoro-offline-store.ts";
import { buildPhaseEndPayload } from "./runtime.ts";
import {
  nextPhaseAfterComplete,
  phaseCompletionKey,
  phaseLabel,
  shouldAutoStartNext,
  startPhaseState,
} from "./timer-engine.ts";

const handledPhaseKeys = new Set<string>();
const putTimers = new Map<string, ReturnType<typeof setTimeout>>();

function isOnline(): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;
  return true;
}

export function isPhaseAlreadyHandled(state: PomodoroActiveState): boolean {
  return handledPhaseKeys.has(phaseCompletionKey(state));
}

export function markPhaseHandled(state: PomodoroActiveState): boolean {
  const key = phaseCompletionKey(state);
  if (handledPhaseKeys.has(key)) return false;
  handledPhaseKeys.add(key);
  return true;
}

export async function applyPomodoroActive(
  next: PomodoroActiveState | null,
  subjectKind: PomodoroSubjectKind,
  opts?: { skipRemote?: boolean },
): Promise<void> {
  const updatedAtMs = Date.now();
  const meta =
    next == null
      ? null
      : {
          device_id: buildHubActivePayload(next, updatedAtMs).device_id,
          updated_at_ms: updatedAtMs,
        };
  applyLocalPomodoroActive(next, subjectKind, meta);
  if (opts?.skipRemote) return;

  if (next == null) {
    if (isOnline()) {
      try {
        await clearPomodoroActiveRemote(subjectKind);
      } catch {
        const { enqueuePomodoroActiveClear } = await import("./pomodoro-offline-store.ts");
        await enqueuePomodoroActiveClear(subjectKind);
      }
    } else {
      const { enqueuePomodoroActiveClear } = await import("./pomodoro-offline-store.ts");
      await enqueuePomodoroActiveClear(subjectKind);
    }
    return;
  }

  scheduleActivePut(next, subjectKind, updatedAtMs);
}

function scheduleActivePut(
  state: PomodoroActiveState,
  subjectKind: PomodoroSubjectKind,
  updatedAtMs: number,
): void {
  const key = subjectKind;
  const prev = putTimers.get(key);
  if (prev) clearTimeout(prev);
  putTimers.set(
    key,
    setTimeout(() => {
      putTimers.delete(key);
      void flushActivePut(state, subjectKind, updatedAtMs);
    }, 300),
  );
}

async function flushActivePut(
  state: PomodoroActiveState,
  subjectKind: PomodoroSubjectKind,
  updatedAtMs: number,
): Promise<void> {
  const active = buildHubActivePayload(state, updatedAtMs);
  if (!isOnline()) {
    const { enqueuePomodoroActivePut } = await import("./pomodoro-offline-store.ts");
    await enqueuePomodoroActivePut(subjectKind, active);
    return;
  }
  try {
    await putPomodoroActiveRemote(subjectKind, active);
  } catch {
    const { enqueuePomodoroActivePut } = await import("./pomodoro-offline-store.ts");
    await enqueuePomodoroActivePut(subjectKind, active);
  }
}

export async function pullPomodoroActive(subjectKind: PomodoroSubjectKind): Promise<void> {
  if (!isOnline()) return;
  try {
    const remote = await fetchPomodoroActive(subjectKind);
    const local = readPomodoroActiveState(undefined, subjectKind);
    const localMeta = getPomodoroSyncMeta(subjectKind);
    const merged = mergeRemoteActive(remote, local, localMeta);
    applyLocalPomodoroActive(merged.active, subjectKind, merged.meta);
  } catch {
    /* 保留本地 */
  }
}

async function persistPhaseEnd(
  state: PomodoroActiveState,
  subjectKind: PomodoroSubjectKind,
  interrupted: boolean,
): Promise<void> {
  const payload = buildPhaseEndPayload(state);
  if (!isOnline()) {
    if (interrupted) await enqueuePomodoroSessionAbort(subjectKind, payload);
    else await enqueuePomodoroSessionComplete(subjectKind, payload);
    return;
  }
  try {
    if (interrupted) await abortPomodoroSession(subjectKind, payload);
    else await completePomodoroSession(subjectKind, payload);
  } catch {
    if (interrupted) await enqueuePomodoroSessionAbort(subjectKind, payload);
    else await enqueuePomodoroSessionComplete(subjectKind, payload);
  }
}
export async function runPhaseComplete(options: {
  state: PomodoroActiveState;
  config: PomodoroConfigRow;
  subjectKind: PomodoroSubjectKind;
  deliverAlerts?: boolean;
}): Promise<"ok" | "duplicate"> {
  const { state, config, subjectKind, deliverAlerts = true } = options;
  if (!markPhaseHandled(state)) return "duplicate";

  const transition = nextPhaseAfterComplete(config, state.phase, state.completedWorkInCycle);
  const autoStart = shouldAutoStartNext(config, state.phase);

  if (!autoStart) {
    await applyPomodoroActive(null, subjectKind);
  } else {
    await applyPomodoroActive(
      startPhaseState(
        config,
        state,
        transition.nextPhase,
        transition.cycleIndex,
        transition.completedWorkInCycle,
      ),
      subjectKind,
    );
  }

  await persistPhaseEnd(state, subjectKind, false);

  if (deliverAlerts && (config.notify_on_phase_end || config.sound_enabled)) {
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

  return "ok";
}

export async function runPhaseAbort(options: {
  state: PomodoroActiveState;
  subjectKind: PomodoroSubjectKind;
}): Promise<void> {
  const { state, subjectKind } = options;
  await applyPomodoroActive(null, subjectKind);
  await persistPhaseEnd(state, subjectKind, true);
}

export function flushPomodoroOutbox(): void {
  void import("../stores/pomodoro-outbox.ts").then((m) =>
    m.usePomodoroOutboxStore.getState().flushAll(),
  );
}
