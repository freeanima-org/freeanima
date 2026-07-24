import { deliverAlert } from "@freeanima/frontend/portal-sdk/alert";
import type { PomodoroActiveState } from "@freeanima/frontend/portal-sdk/pomodoro-active-types.ts";
import {
  applyLocalPomodoroActive,
  buildHubActivePayload,
  getPomodoroSyncMeta,
  mergeRemoteActive,
} from "@freeanima/frontend/portal-sdk/pomodoro-sync-local.ts";
import { readPomodoroActiveState } from "@freeanima/frontend/portal-sdk/pomodoro-active.ts";
import { getHabitatRpcConnectionState } from "@freeanima/frontend/portal-sdk/habitat-connection.ts";
import { preferOnlineWrite } from "@freeanima/frontend/portal-sdk/prefer-online-write";

import {
  abortPomodoroSession,
  clearPomodoroActiveRemote,
  completePomodoroSession,
  fetchPomodoroActive,
  fetchPomodoroConfig,
  putPomodoroActiveRemote,
  type PomodoroConfigRow,
  type PomodoroSubjectKind,
} from "./api.ts";
import {
  cancelPomodoroPhaseAlert,
  pomodoroPhaseAlertTag,
  syncPomodoroPhaseLocalAlert,
} from "./pomodoro-phase-alert.ts";
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

function hubReady(): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;
  return getHabitatRpcConnectionState() === "connected";
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

async function resolveAlertConfig(
  subjectKind: PomodoroSubjectKind,
  explicit?: PomodoroConfigRow | null,
): Promise<PomodoroConfigRow | null> {
  if (explicit !== undefined) return explicit;
  try {
    return await fetchPomodoroConfig(subjectKind);
  } catch {
    return null;
  }
}

export async function applyPomodoroActive(
  next: PomodoroActiveState | null,
  subjectKind: PomodoroSubjectKind,
  opts?: { skipRemote?: boolean; alertConfig?: PomodoroConfigRow | null },
): Promise<void> {
  const prev = readPomodoroActiveState(undefined, subjectKind);
  const updatedAtMs = Date.now();
  const meta =
    next == null
      ? null
      : {
          device_id: buildHubActivePayload(next, updatedAtMs).device_id,
          updated_at_ms: updatedAtMs,
        };
  applyLocalPomodoroActive(next, subjectKind, meta);

  const alertConfig = await resolveAlertConfig(subjectKind, opts?.alertConfig);
  await syncPomodoroPhaseLocalAlert(prev, next, alertConfig);

  if (opts?.skipRemote) return;

  if (next == null) {
    cancelScheduledPut(subjectKind);
    await preferOnlineWrite(
      async () => {
        await clearPomodoroActiveRemote(subjectKind);
      },
      async () => {
        const { enqueuePomodoroActiveClear } = await import("./pomodoro-offline-store.ts");
        await enqueuePomodoroActiveClear(subjectKind);
      },
    );
    return;
  }

  const immediate = prev == null || prev.sessionLocalId !== next.sessionLocalId;
  scheduleActivePut(subjectKind, updatedAtMs, immediate);
}

function cancelScheduledPut(subjectKind: PomodoroSubjectKind): void {
  const prev = putTimers.get(subjectKind);
  if (prev) clearTimeout(prev);
  putTimers.delete(subjectKind);
}

function scheduleActivePut(
  subjectKind: PomodoroSubjectKind,
  updatedAtMs: number,
  immediate: boolean,
): void {
  cancelScheduledPut(subjectKind);
  if (immediate) {
    void flushActivePut(subjectKind, updatedAtMs);
    return;
  }
  putTimers.set(
    subjectKind,
    setTimeout(() => {
      putTimers.delete(subjectKind);
      void flushActivePut(subjectKind, updatedAtMs);
    }, 300),
  );
}

async function flushActivePut(
  subjectKind: PomodoroSubjectKind,
  _scheduledAtMs: number,
): Promise<void> {
  const state = readPomodoroActiveState(undefined, subjectKind);
  if (!state) return;
  const syncedAtMs = Date.now();
  const active = buildHubActivePayload(state, syncedAtMs);
  await preferOnlineWrite(
    async () => {
      await putPomodoroActiveRemote(subjectKind, active);
      applyLocalPomodoroActive(state, subjectKind, {
        device_id: active.device_id,
        updated_at_ms: syncedAtMs,
      });
    },
    async () => {
      const { enqueuePomodoroActivePut } = await import("./pomodoro-offline-store.ts");
      await enqueuePomodoroActivePut(subjectKind, active);
    },
  );
}

export async function pullPomodoroActive(subjectKind: PomodoroSubjectKind): Promise<void> {
  if (!hubReady()) return;
  try {
    const remote = await fetchPomodoroActive(subjectKind);
    const local = readPomodoroActiveState(undefined, subjectKind);
    const localMeta = getPomodoroSyncMeta(subjectKind);
    const merged = mergeRemoteActive(remote, local, localMeta);
    const prev = local;
    applyLocalPomodoroActive(merged.active, subjectKind, merged.meta);
    const alertConfig = await resolveAlertConfig(subjectKind);
    await syncPomodoroPhaseLocalAlert(prev, merged.active, alertConfig);
  } catch {
    /* 保留本地 */
  }
}

/** Habitat `pomodoro.active.changed` 推送：null 表示对端 clear，直接清空本地。 */
export function applyPomodoroActiveChangedEvent(
  subjectKind: PomodoroSubjectKind,
  remote: Parameters<typeof mergeRemoteActive>[0],
): void {
  const prev = readPomodoroActiveState(undefined, subjectKind);
  if (remote == null) {
    applyLocalPomodoroActive(null, subjectKind, null);
    void syncPomodoroPhaseLocalAlert(prev, null, null);
    return;
  }
  const local = prev;
  const localMeta = getPomodoroSyncMeta(subjectKind);
  const merged = mergeRemoteActive(remote, local, localMeta);
  applyLocalPomodoroActive(merged.active, subjectKind, merged.meta);
  void resolveAlertConfig(subjectKind).then((config) =>
    syncPomodoroPhaseLocalAlert(prev, merged.active, config),
  );
}

async function persistPhaseEnd(
  state: PomodoroActiveState,
  subjectKind: PomodoroSubjectKind,
  interrupted: boolean,
): Promise<void> {
  const payload = buildPhaseEndPayload(state);
  await preferOnlineWrite(
    async () => {
      if (interrupted) await abortPomodoroSession(subjectKind, payload);
      else await completePomodoroSession(subjectKind, payload);
    },
    async () => {
      if (interrupted) await enqueuePomodoroSessionAbort(subjectKind, payload);
      else await enqueuePomodoroSessionComplete(subjectKind, payload);
    },
  );
}

export async function runPhaseComplete(options: {
  state: PomodoroActiveState;
  config: PomodoroConfigRow;
  subjectKind: PomodoroSubjectKind;
  deliverAlerts?: boolean;
}): Promise<"ok" | "duplicate"> {
  const { state, config, subjectKind, deliverAlerts = true } = options;
  if (!markPhaseHandled(state)) return "duplicate";

  const completedTag = pomodoroPhaseAlertTag(state);
  /* 撤掉本阶段预登记，避免与即时 deliver 双弹；页存活时由 deliver 兜底 */
  await cancelPomodoroPhaseAlert(state);

  const transition = nextPhaseAfterComplete(config, state.phase, state.completedWorkInCycle);
  const autoStart = shouldAutoStartNext(config, state.phase);

  if (!autoStart) {
    await applyPomodoroActive(null, subjectKind, { alertConfig: config });
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
      { alertConfig: config },
    );
  }

  await persistPhaseEnd(state, subjectKind, false);

  if (deliverAlerts && (config.notify_on_phase_end || config.sound_enabled)) {
    void deliverAlert(
      {
        title: `${phaseLabel(state.phase)}结束`,
        body: state.phase === "work" ? "休息一下" : "准备下一轮专注",
        tag: completedTag,
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
  await cancelPomodoroPhaseAlert(state);
  await applyPomodoroActive(null, subjectKind, { alertConfig: null });
  await persistPhaseEnd(state, subjectKind, true);
}

export function flushPomodoroOutbox(): void {
  void import("../stores/pomodoro-outbox.ts").then((m) =>
    m.usePomodoroOutboxStore.getState().flushAll(),
  );
}
