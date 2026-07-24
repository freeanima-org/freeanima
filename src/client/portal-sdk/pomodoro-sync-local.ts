/// <reference lib="dom" />
import type { PomodoroActiveBody } from "@freeanima/host/core/db/schema/entity";
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

function subjectKey(subjectKind: string): string {
  return subjectKind;
}

function metaStorageKey(subjectKind: string): string {
  return `${META_PREFIX}:${subjectKind}`;
}

function readPersistedMeta(subjectKind: string): PomodoroSyncMeta | null {
  try {
    const store = storage();
    if (!store) return null;
    const raw = store.getItem(metaStorageKey(subjectKind));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PomodoroSyncMeta;
    if (typeof parsed.device_id !== "string" || typeof parsed.updated_at_ms !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writePersistedMeta(subjectKind: string, meta: PomodoroSyncMeta | null): void {
  try {
    const store = storage();
    if (!store) return;
    const key = metaStorageKey(subjectKind);
    if (meta == null) {
      store.removeItem(key);
      return;
    }
    store.setItem(key, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

function notify(subjectKind: string): void {
  const snapshot = getPomodoroSyncSnapshot(subjectKind);
  for (const listener of listeners) listener(snapshot);
}

export function subscribePomodoroSync(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPomodoroSyncMeta(subjectKind: string): PomodoroSyncMeta | null {
  return metaBySubject.get(subjectKey(subjectKind)) ?? readPersistedMeta(subjectKind);
}

export function getPomodoroSyncSnapshot(subjectKind: string): PomodoroSyncSnapshot {
  return {
    active: readPomodoroActiveState(undefined, subjectKind as "user" | "agent"),
    meta: getPomodoroSyncMeta(subjectKind),
  };
}

export function setPomodoroSyncMeta(subjectKind: string, meta: PomodoroSyncMeta | null): void {
  const key = subjectKey(subjectKind);
  if (meta == null) {
    metaBySubject.delete(key);
    writePersistedMeta(subjectKind, null);
  } else {
    metaBySubject.set(key, meta);
    writePersistedMeta(subjectKind, meta);
  }
}

export function applyLocalPomodoroActive(
  next: PomodoroActiveState | null,
  subjectKind: "user" | "agent",
  meta?: PomodoroSyncMeta | null,
): void {
  writePomodoroActiveState(next, undefined, subjectKind);
  setPomodoroSyncMeta(subjectKind, meta ?? null);
  notify(subjectKind);
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
): { active: PomodoroActiveState | null; meta: PomodoroSyncMeta | null } {
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

export function dispatchPomodoroActiveChanged(subjectKind: string): void {
  notify(subjectKind);
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
