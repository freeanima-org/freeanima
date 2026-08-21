/// <reference lib="dom" />
import type { PomodoroActiveBody } from "@freeanima/shared/entity-shapes";
import { isRecord } from "@freeanima/shared/util";

import type { PomodoroActiveState } from "./pomodoro-active-types.ts";
import { activeStateToHabitatBody, habitatBodyToActiveState } from "./pomodoro-active-store.ts";
import { readPomodoroActiveState, writePomodoroActiveState } from "./pomodoro-active.ts";
import { getPomodoroDeviceId } from "./pomodoro-device-id.ts";

export type PomodoroSyncMeta = {
  device_id: string;
  updated_at_ms: number;
};

export type PomodoroSyncSnapshot = {
  active: PomodoroActiveState | null;
  meta: PomodoroSyncMeta | null;
};

type SyncListener = (snapshot: PomodoroSyncSnapshot) => void;

const listeners = new Set<SyncListener>();
const metaBySubject = new Map<string, PomodoroSyncMeta>();
const META_PREFIX = "freeanima.pomodoro.sync-meta";

function storage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function subjectKey(subjectId: number): string {
  return String(subjectId);
}

function metaStorageKey(subjectId: number): string {
  return `${META_PREFIX}:${subjectId}`;
}

function readPersistedMeta(subjectId: number): PomodoroSyncMeta | null {
  try {
    const store = storage();
    if (!store) return null;
    const raw = store.getItem(metaStorageKey(subjectId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    if (typeof parsed.device_id !== "string" || typeof parsed.updated_at_ms !== "number") {
      return null;
    }
    return { device_id: parsed.device_id, updated_at_ms: parsed.updated_at_ms };
  } catch {
    return null;
  }
}

function writePersistedMeta(subjectId: number, meta: PomodoroSyncMeta | null): void {
  try {
    const store = storage();
    if (!store) return;
    const key = metaStorageKey(subjectId);
    if (meta == null) {
      store.removeItem(key);
      return;
    }
    store.setItem(key, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

function notify(subjectId: number): void {
  const snapshot = getPomodoroSyncSnapshot(subjectId);
  for (const listener of listeners) listener(snapshot);
}

export function subscribePomodoroSync(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPomodoroSyncMeta(subjectId: number): PomodoroSyncMeta | null {
  return metaBySubject.get(subjectKey(subjectId)) ?? readPersistedMeta(subjectId);
}

export function getPomodoroSyncSnapshot(subjectId: number): PomodoroSyncSnapshot {
  return {
    active: subjectId > 0 ? readPomodoroActiveState(undefined, subjectId) : null,
    meta: getPomodoroSyncMeta(subjectId),
  };
}

export function setPomodoroSyncMeta(subjectId: number, meta: PomodoroSyncMeta | null): void {
  const key = subjectKey(subjectId);
  if (meta == null) {
    metaBySubject.delete(key);
    writePersistedMeta(subjectId, null);
  } else {
    metaBySubject.set(key, meta);
    writePersistedMeta(subjectId, meta);
  }
}

export function applyLocalPomodoroActive(
  next: PomodoroActiveState | null,
  subjectId: number,
  meta?: PomodoroSyncMeta | null,
  opts?: { broadcastShell?: boolean },
): void {
  writePomodoroActiveState(next, undefined, subjectId);
  setPomodoroSyncMeta(subjectId, meta ?? null);
  notify(subjectId);
  if (opts?.broadcastShell === false) return;
  try {
    const shell = typeof window !== "undefined" ? window.portalShell : undefined;
    void shell
      ?.emitPomodoroActiveSync?.({
        subject_id: subjectId,
        active: next,
        meta: meta ?? null,
      })
      .catch(() => undefined);
  } catch {
    /* ignore */
  }
}

export function buildHubActivePayload(
  state: PomodoroActiveState,
  updatedAtMs: number = Date.now(),
): PomodoroActiveBody {
  return activeStateToHabitatBody(state, getPomodoroDeviceId(), updatedAtMs);
}

export function mergeRemoteActive(
  remote: PomodoroActiveBody | null,
  local: PomodoroActiveState | null,
  localMeta: PomodoroSyncMeta | null,
  opts?: { preferRemote?: boolean },
): { active: PomodoroActiveState | null; meta: PomodoroSyncMeta | null } {
  if (opts?.preferRemote) {
    if (!remote) return { active: null, meta: null };
    return {
      active: habitatBodyToActiveState(remote),
      meta: { device_id: remote.device_id, updated_at_ms: remote.updated_at_ms },
    };
  }
  if (!remote) {
    return { active: local, meta: localMeta };
  }
  const remoteMeta = { device_id: remote.device_id, updated_at_ms: remote.updated_at_ms };
  if (!local) {
    return { active: habitatBodyToActiveState(remote), meta: remoteMeta };
  }
  if (!localMeta || remote.updated_at_ms >= localMeta.updated_at_ms) {
    return { active: habitatBodyToActiveState(remote), meta: remoteMeta };
  }
  return { active: local, meta: localMeta };
}

export function dispatchPomodoroActiveChanged(subjectId: number): void {
  notify(subjectId);
}

export function clearPomodoroSyncMetaForTest(): void {
  metaBySubject.clear();
  try {
    const store = storage();
    if (!store) return;
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key?.startsWith(`${META_PREFIX}:`)) keys.push(key);
    }
    for (const key of keys) store.removeItem(key);
  } catch {
    /* ignore */
  }
}
