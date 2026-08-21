import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  clearPomodoroActiveStateForTest,
  readPomodoroActiveState,
  writePomodoroActiveState,
} from "@freeanima/client/portal-sdk/pomodoro-active.ts";
import { resetSubjectScopeForTest } from "@freeanima/client/portal-sdk/subject-scope-store.ts";

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
    const state = createInitialActiveState(config, { taskItemId: 42 }, 1_000_000);
    writePomodoroActiveState(state, undefined, 1);
    expect(localStorage.getItem("freeanima.pomodoro.active:1")).not.toBeNull();
    expect(readPomodoroActiveState(undefined, 1)).toEqual(state);
  });

  test("reads and migrates legacy habitat-scoped storage key", () => {
    const state = createInitialActiveState(config, {}, 1_000_000);
    localStorage.setItem(`freeanima.pomodoro.active:${HABITAT}:1:1`, JSON.stringify(state));
    expect(readPomodoroActiveState(undefined, 1)).toEqual(state);
    expect(localStorage.getItem("freeanima.pomodoro.active:1")).not.toBeNull();
    expect(localStorage.getItem(`freeanima.pomodoro.active:${HABITAT}:1:1`)).toBeNull();
  });
});
