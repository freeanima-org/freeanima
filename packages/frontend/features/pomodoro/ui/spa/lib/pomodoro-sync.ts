import { deliverLocalReminder } from "@freeanima/client/portal-sdk/local-reminder.ts";
import type { PomodoroActiveState } from "@freeanima/client/portal-sdk/pomodoro-active-types.ts";
import {
  applyLocalPomodoroActive,
  buildHubActivePayload,
  getPomodoroSyncMeta,
  mergeRemoteActive,
} from "@freeanima/client/portal-sdk/pomodoro-sync-local.ts";
import { readPomodoroActiveState } from "@freeanima/client/portal-sdk/pomodoro-active.ts";
import { getHabitatRpcConnectionState } from "@freeanima/client/portal-sdk/habitat-connection.ts";
import { preferOnlineWrite } from "@freeanima/client/portal-sdk/prefer-online-write";

import {
  abortPomodoroSession,
  clearPomodoroActiveRemote,
  completePomodoroSession,
  fetchPomodoroActive,
  fetchPomodoroConfig,
  putPomodoroActiveRemote,
  type PomodoroConfigRow,
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
const putTimers = new Map<number, ReturnType<typeof setTimeout>>();

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

export function clearHandledPhaseKeysForTest(): void {
  handledPhaseKeys.clear();
}

async function resolveAlertConfig(
  subjectId: number,
  explicit?: PomodoroConfigRow | null,
): Promise<PomodoroConfigRow | null> {
  if (explicit !== undefined) return explicit;
  try {
    return await fetchPomodoroConfig(subjectId);
  } catch {
    return null;
  }
}

export async function applyPomodoroActive(
  next: PomodoroActiveState | null,
  subjectId: number,
  opts?: { skipRemote?: boolean; alertConfig?: PomodoroConfigRow | null },
): Promise<void> {
  const prev = readPomodoroActiveState(undefined, subjectId);
  const updatedAtMs = Date.now();
  const meta =
    next == null
      ? null
      : {
          device_id: buildHubActivePayload(next, updatedAtMs).device_id,
          updated_at_ms: updatedAtMs,
        };
  applyLocalPomodoroActive(next, subjectId, meta);

  const alertConfig = await resolveAlertConfig(subjectId, opts?.alertConfig);
  await syncPomodoroPhaseLocalAlert(prev, next, alertConfig);

  if (opts?.skipRemote) return;

  if (next == null) {
    cancelScheduledPut(subjectId);
    await preferOnlineWrite(
      async () => {
        await clearPomodoroActiveRemote(subjectId);
      },
      async () => {
        const { enqueuePomodoroActiveClear } = await import("./pomodoro-offline-store.ts");
        await enqueuePomodoroActiveClear(subjectId);
      },
    );
    return;
  }

  const immediate = prev == null || prev.sessionLocalId !== next.sessionLocalId;
  scheduleActivePut(subjectId, updatedAtMs, immediate);
}

function cancelScheduledPut(subjectId: number): void {
  const prev = putTimers.get(subjectId);
  if (prev) clearTimeout(prev);
  putTimers.delete(subjectId);
}

function scheduleActivePut(subjectId: number, updatedAtMs: number, immediate: boolean): void {
  cancelScheduledPut(subjectId);
  if (immediate) {
    void flushActivePut(subjectId, updatedAtMs);
    return;
  }
  putTimers.set(
    subjectId,
    setTimeout(() => {
      putTimers.delete(subjectId);
      void flushActivePut(subjectId, updatedAtMs);
    }, 300),
  );
}

async function flushActivePut(subjectId: number, _scheduledAtMs: number): Promise<void> {
  const state = readPomodoroActiveState(undefined, subjectId);
  if (!state) return;
  const syncedAtMs = Date.now();
  const active = buildHubActivePayload(state, syncedAtMs);
  await preferOnlineWrite(
    async () => {
      await putPomodoroActiveRemote(subjectId, active);
      applyLocalPomodoroActive(state, subjectId, {
        device_id: active.device_id,
        updated_at_ms: syncedAtMs,
      });
    },
    async () => {
      const { enqueuePomodoroActivePut } = await import("./pomodoro-offline-store.ts");
      await enqueuePomodoroActivePut(subjectId, active);
    },
  );
}

export async function pullPomodoroActive(
  subjectId: number,
  opts?: { preferRemote?: boolean },
): Promise<void> {
  if (!hubReady()) return;
  try {
    const remote = await fetchPomodoroActive(subjectId);
    const local = readPomodoroActiveState(undefined, subjectId);
    const localMeta = getPomodoroSyncMeta(subjectId);
    const merged = mergeRemoteActive(remote, local, localMeta, {
      preferRemote: opts?.preferRemote === true,
    });
    const prev = local;
    applyLocalPomodoroActive(merged.active, subjectId, merged.meta);
    const alertConfig = await resolveAlertConfig(subjectId);
    await syncPomodoroPhaseLocalAlert(prev, merged.active, alertConfig);
  } catch {
    /* 保留本地 */
  }
}

/** Habitat `pomodoro.active.changed` 推送：null 表示对端 clear，直接清空本地。 */
export function applyPomodoroActiveChangedEvent(
  subjectId: number,
  remote: Parameters<typeof mergeRemoteActive>[0],
): void {
  const prev = readPomodoroActiveState(undefined, subjectId);
  if (remote == null) {
    applyLocalPomodoroActive(null, subjectId, null);
    void syncPomodoroPhaseLocalAlert(prev, null, null);
    return;
  }
  const local = prev;
  const localMeta = getPomodoroSyncMeta(subjectId);
  const merged = mergeRemoteActive(remote, local, localMeta);
  applyLocalPomodoroActive(merged.active, subjectId, merged.meta);
  void resolveAlertConfig(subjectId).then((config) =>
    syncPomodoroPhaseLocalAlert(prev, merged.active, config),
  );
}

async function persistPhaseEnd(
  state: PomodoroActiveState,
  subjectId: number,
  interrupted: boolean,
): Promise<void> {
  const payload = buildPhaseEndPayload(state);
  await preferOnlineWrite(
    async () => {
      if (interrupted) await abortPomodoroSession(subjectId, payload);
      else await completePomodoroSession(subjectId, payload);
    },
    async () => {
      if (interrupted) await enqueuePomodoroSessionAbort(subjectId, payload);
      else await enqueuePomodoroSessionComplete(subjectId, payload);
    },
  );
}

export async function runPhaseComplete(options: {
  state: PomodoroActiveState;
  config: PomodoroConfigRow;
  subjectId: number;
  deliverAlerts?: boolean;
}): Promise<"ok" | "duplicate"> {
  const { state, config, subjectId, deliverAlerts = true } = options;
  // 跨 WebView（主壳 ↔ 迷你窗）可能同时看到 remaining=0；先确认本地仍是同一阶段
  const current = readPomodoroActiveState(undefined, subjectId);
  if (
    current == null ||
    phaseCompletionKey(current) !== phaseCompletionKey(state) ||
    current.runState !== "running"
  ) {
    return "duplicate";
  }
  if (!markPhaseHandled(state)) return "duplicate";

  const completedTag = pomodoroPhaseAlertTag(state);
  const transition = nextPhaseAfterComplete(config, state.phase, state.completedWorkInCycle);
  const autoStart = shouldAutoStartNext(config, state.phase);

  // 先落本地并广播，缩短主壳/迷你窗同时看到 remaining=0 的竞态窗口
  // （syncPomodoroPhaseLocalAlert 会撤掉本阶段预登记，避免与下方 deliver 双弹）
  if (!autoStart) {
    await applyPomodoroActive(null, subjectId, { alertConfig: config });
  } else {
    await applyPomodoroActive(
      startPhaseState(
        config,
        state,
        transition.nextPhase,
        transition.cycleIndex,
        transition.completedWorkInCycle,
      ),
      subjectId,
      { alertConfig: config },
    );
  }

  await persistPhaseEnd(state, subjectId, false);

  if (deliverAlerts && (config.notify_on_phase_end || config.sound_enabled)) {
    void deliverLocalReminder({
      title: `${phaseLabel(state.phase)}结束`,
      body: state.phase === "work" ? "休息一下" : "准备下一轮专注",
      tag: completedTag,
      sound: config.sound_enabled,
      silent: !config.notify_on_phase_end,
      sourceRoute: "/pomodoro",
    });
  }

  return "ok";
}

export async function runPhaseAbort(options: {
  state: PomodoroActiveState;
  subjectId: number;
}): Promise<void> {
  const { state, subjectId } = options;
  await cancelPomodoroPhaseAlert(state);
  await applyPomodoroActive(null, subjectId, { alertConfig: null });
  await persistPhaseEnd(state, subjectId, true);
}

export function flushPomodoroOutbox(): void {
  void import("../stores/pomodoro-outbox.ts").then((m) =>
    m.usePomodoroOutboxStore.getState().flushAll(),
  );
}
