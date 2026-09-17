/// <reference lib="dom" />
import { isRecord } from "@freeanima/shared/util";

import { getCachedUserSubjectId } from "./world-context.ts";

import type { PomodoroActiveState } from "./pomodoro-active-types.ts";
import { normalizeRestoredActiveState, switchWorkFocusTask } from "./pomodoro-focus-segments.ts";

const STORAGE_PREFIX = "freeanima.pomodoro.active";

function storage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function storageKey(subjectId: number): string {
  return `${STORAGE_PREFIX}:${subjectId}`;
}

function parseStoredState(raw: string): PomodoroActiveState | null {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) return null;
  if (parsed.runState !== "running" && parsed.runState !== "paused") return null;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- localStorage JSON → PomodoroActiveState（后续 normalizeRestoredActiveState 再归一）
  return parsed as PomodoroActiveState;
}

function isLegacyKeyForSubject(key: string, subjectId: number): boolean {
  if (!key.startsWith(`${STORAGE_PREFIX}:`)) return false;
  if (key === storageKey(subjectId)) return false;
  return key.endsWith(`:${subjectId}`) || key.endsWith(`:${subjectId}:${subjectId}`);
}

/** 读取时兼容历史 habitatScope 键名，找到后迁移到 subject-only 键。 */
function findStoredRaw(subjectId: number): { raw: string; legacyKey: string | null } | null {
  const store = storage();
  if (!store) return null;

  const primary = store.getItem(storageKey(subjectId));
  if (primary) return { raw: primary, legacyKey: null };

  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (!key || !isLegacyKeyForSubject(key, subjectId)) continue;
    const raw = store.getItem(key);
    if (raw) return { raw, legacyKey: key };
  }
  return null;
}

function removeLegacyKeysForSubject(subjectId: number, keepKey?: string): void {
  const store = storage();
  if (!store) return;
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (!key || key === keepKey || !isLegacyKeyForSubject(key, subjectId)) continue;
    store.removeItem(key);
  }
}

function migrateToPrimaryKey(subjectId: number, raw: string, legacyKey: string | null): void {
  const store = storage();
  if (!store) return;
  const key = storageKey(subjectId);
  store.setItem(key, raw);
  if (legacyKey && legacyKey !== key) store.removeItem(legacyKey);
  removeLegacyKeysForSubject(subjectId, key);
}

export function readPomodoroActiveState(
  _hubPart?: string,
  subjectId?: number,
): PomodoroActiveState | null {
  try {
    const kind = subjectId ?? getCachedUserSubjectId();
    const found = findStoredRaw(kind);
    if (!found) return null;
    const parsed = parseStoredState(found.raw);
    if (!parsed) return null;
    if (found.legacyKey) {
      migrateToPrimaryKey(kind, found.raw, found.legacyKey);
    }
    return normalizeRestoredActiveState(parsed);
  } catch {
    return null;
  }
}

export function writePomodoroActiveState(
  state: PomodoroActiveState | null,
  _hubPart?: string,
  subjectId?: number,
): void {
  try {
    const kind = subjectId ?? getCachedUserSubjectId();
    const store = storage();
    if (!store) return;
    const key = storageKey(kind);
    if (state == null) {
      store.removeItem(key);
      removeLegacyKeysForSubject(kind);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("freeanima:pomodoro-active-changed", { detail: { subjectId: kind } }),
        );
      }
      return;
    }
    const raw = JSON.stringify(state);
    store.setItem(key, raw);
    removeLegacyKeysForSubject(kind, key);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("freeanima:pomodoro-active-changed", { detail: { subjectId: kind } }),
      );
      // Tauri 移动：同步主屏小组件快照（失败忽略）
      if (window.portalShell?.isTauri) {
        const remainingMs =
          state.phaseEndsAt != null
            ? Math.max(0, state.phaseEndsAt - Date.now())
            : (state.pausedRemainingMs ?? 0);
        void import("@freeanima/portal/app/tauri/bridge/bootstrap-tauri-mobile.ts")
          .then(({ syncPomodoroWidgetState }) =>
            syncPomodoroWidgetState({
              phase: state.phase,
              remainingSec: Math.floor(remainingMs / 1000),
            }),
          )
          .catch(() => undefined);
      }
    }
  } catch {
    /* ignore */
  }
}

export function switchPomodoroActiveTask(
  taskItemId: number,
  _hubPart?: string,
  subjectId?: number,
): boolean {
  const active = readPomodoroActiveState(undefined, subjectId);
  if (!active) return false;
  writePomodoroActiveState(switchWorkFocusTask(active, taskItemId), undefined, subjectId);
  return true;
}

export function clearPomodoroActiveStateForTest(): void {
  if (typeof localStorage === "undefined") return;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(`${STORAGE_PREFIX}:`)) keys.push(key);
  }
  for (const key of keys) localStorage.removeItem(key);
}
