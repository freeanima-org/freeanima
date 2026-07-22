/// <reference lib="dom" />
import { getSubjectKind } from "./subject-scope-store.ts";
import type { SubjectKind } from "./subject-scope.ts";

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

function storageKey(subjectKind: SubjectKind): string {
  return `${STORAGE_PREFIX}:${subjectKind}`;
}

function parseStoredState(raw: string): PomodoroActiveState | null {
  const parsed = JSON.parse(raw) as PomodoroActiveState;
  if (parsed.runState !== "running" && parsed.runState !== "paused") return null;
  return parsed;
}

function isLegacyKeyForSubject(key: string, subjectKind: SubjectKind): boolean {
  if (!key.startsWith(`${STORAGE_PREFIX}:`)) return false;
  if (key === storageKey(subjectKind)) return false;
  return key.endsWith(`:${subjectKind}`) || key.endsWith(`:${subjectKind}:${subjectKind}`);
}

/** 读取时兼容历史 habitatScope 键名，找到后迁移到 subject-only 键。 */
function findStoredRaw(subjectKind: SubjectKind): { raw: string; legacyKey: string | null } | null {
  const store = storage();
  if (!store) return null;

  const primary = store.getItem(storageKey(subjectKind));
  if (primary) return { raw: primary, legacyKey: null };

  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (!key || !isLegacyKeyForSubject(key, subjectKind)) continue;
    const raw = store.getItem(key);
    if (raw) return { raw, legacyKey: key };
  }
  return null;
}

function removeLegacyKeysForSubject(subjectKind: SubjectKind, keepKey?: string): void {
  const store = storage();
  if (!store) return;
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (!key || key === keepKey || !isLegacyKeyForSubject(key, subjectKind)) continue;
    store.removeItem(key);
  }
}

function migrateToPrimaryKey(
  subjectKind: SubjectKind,
  raw: string,
  legacyKey: string | null,
): void {
  const store = storage();
  if (!store) return;
  const key = storageKey(subjectKind);
  store.setItem(key, raw);
  if (legacyKey && legacyKey !== key) store.removeItem(legacyKey);
  removeLegacyKeysForSubject(subjectKind, key);
}

export function readPomodoroActiveState(
  _hubPart?: string,
  subjectKind?: SubjectKind,
): PomodoroActiveState | null {
  try {
    const kind = subjectKind ?? getSubjectKind();
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
  subjectKind?: SubjectKind,
): void {
  try {
    const kind = subjectKind ?? getSubjectKind();
    const store = storage();
    if (!store) return;
    const key = storageKey(kind);
    if (state == null) {
      store.removeItem(key);
      removeLegacyKeysForSubject(kind);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("freeanima:pomodoro-active-changed", { detail: { subjectKind: kind } }),
        );
      }
      return;
    }
    const raw = JSON.stringify(state);
    store.setItem(key, raw);
    removeLegacyKeysForSubject(kind, key);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("freeanima:pomodoro-active-changed", { detail: { subjectKind: kind } }),
      );
      // Tauri 移动：同步主屏小组件快照（失败忽略）
      if (window.satelliteShell?.isTauri) {
        const remainingMs =
          state.phaseEndsAt != null
            ? Math.max(0, state.phaseEndsAt - Date.now())
            : (state.pausedRemainingMs ?? 0);
        void import("@freeanima/app/shell/tauri/bridge/bootstrap-tauri-mobile.ts")
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
  subjectKind?: SubjectKind,
): boolean {
  const active = readPomodoroActiveState(undefined, subjectKind);
  if (!active) return false;
  writePomodoroActiveState(switchWorkFocusTask(active, taskItemId), undefined, subjectKind);
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
