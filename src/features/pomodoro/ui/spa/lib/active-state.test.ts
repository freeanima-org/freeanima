import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  clearPomodoroActiveStateForTest,
  readPomodoroActiveState,
  writePomodoroActiveState,
} from "@freeanima/frontend/shell-sdk/pomodoro-active.ts";
import {
  resetSubjectScopeForTest,
  setSubjectKind,
} from "@freeanima/frontend/shell-sdk/subject-scope-store.ts";

import { createInitialActiveState } from "./timer-engine.ts";
import type { PomodoroConfigRow } from "./api.ts";

const config: PomodoroConfigRow = {
  work_minutes: 25,
  short_break_minutes: 5,
  long_break_minutes: 15,
  cycles_before_long_break: 4,
  auto_start_break: true,
  auto_start_work: false,
  notify_on_phase_end: true,
  sound_enabled: true,
};

const HABITAT = "ws://127.0.0.1:2658/rpc/v1";

function mockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

beforeEach(() => {
  globalThis.localStorage = mockLocalStorage();
});

afterEach(() => {
  clearPomodoroActiveStateForTest();
  resetSubjectScopeForTest();
});

describe("pomodoro active-state", () => {
  test("round-trips running state with subject-only key", () => {
    setSubjectKind("user");
    const state = createInitialActiveState(config, { taskItemId: 42 }, 1_000_000);
    writePomodoroActiveState(state, undefined, "user");
    expect(localStorage.getItem("freeanima.pomodoro.active:user")).not.toBeNull();
    expect(readPomodoroActiveState(undefined, "user")).toEqual(state);
  });

  test("reads and migrates legacy habitat-scoped storage key", () => {
    const state = createInitialActiveState(config, {}, 1_000_000);
    localStorage.setItem(`freeanima.pomodoro.active:${HABITAT}:user:user`, JSON.stringify(state));
    expect(readPomodoroActiveState(undefined, "user")).toEqual(state);
    expect(localStorage.getItem("freeanima.pomodoro.active:user")).not.toBeNull();
    expect(localStorage.getItem(`freeanima.pomodoro.active:${HABITAT}:user:user`)).toBeNull();
  });
});
