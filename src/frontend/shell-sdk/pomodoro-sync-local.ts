/// <reference lib="dom" />
import type { PomodoroActiveBody } from "@freeanima/core/db/schema/entity";
import type { PomodoroActiveState } from "./pomodoro-active-types.ts";
import { activeStateToHubBody, hubBodyToActiveState } from "./pomodoro-active-hub.ts";
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

function subjectKey(subjectKind: string): string {
  return subjectKind;
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
  return metaBySubject.get(subjectKey(subjectKind)) ?? null;
}

export function getPomodoroSyncSnapshot(subjectKind: string): PomodoroSyncSnapshot {
  return {
    active: readPomodoroActiveState(undefined, subjectKind as "user" | "agent"),
    meta: getPomodoroSyncMeta(subjectKind),
  };
}

export function setPomodoroSyncMeta(subjectKind: string, meta: PomodoroSyncMeta | null): void {
  const key = subjectKey(subjectKind);
  if (meta == null) metaBySubject.delete(key);
  else metaBySubject.set(key, meta);
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
  return activeStateToHubBody(state, getPomodoroDeviceId(), updatedAtMs);
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
  if (!localMeta || remote.updated_at_ms >= localMeta.updated_at_ms) {
    return { active: hubBodyToActiveState(remote), meta: remoteMeta };
  }
  return { active: local, meta: localMeta };
}

export function dispatchPomodoroActiveChanged(subjectKind: string): void {
  notify(subjectKind);
}
