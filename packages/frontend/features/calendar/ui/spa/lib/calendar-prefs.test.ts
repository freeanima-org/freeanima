import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  resetCalendarPrefsForTest,
  readCalendarUiPrefs,
  writeCalendarUiPrefs,
  isAgendaViewMode,
  currentViewDisplay,
} from "./calendar-prefs.ts";

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

describe("calendar-prefs", () => {
  beforeEach(() => {
    globalThis.localStorage = mockLocalStorage();
    resetCalendarPrefsForTest();
  });

  afterEach(() => {
    resetCalendarPrefsForTest();
  });

  test("解析日/近三天/近七天视图", () => {
    writeCalendarUiPrefs({ viewMode: "day" });
    expect(readCalendarUiPrefs().viewMode).toBe("day");
    writeCalendarUiPrefs({ viewMode: "next3" });
    expect(readCalendarUiPrefs().viewMode).toBe("next3");
    writeCalendarUiPrefs({ viewMode: "next7" });
    expect(readCalendarUiPrefs().viewMode).toBe("next7");
  });

  test("旧值 today 映射为 day", () => {
    localStorage.setItem(
      "freeanima.calendar.uiPrefs",
      JSON.stringify({ expandRecurrence: true, viewMode: "today", kinds: ["event"] }),
    );
    expect(readCalendarUiPrefs().viewMode).toBe("day");
  });

  test("未知 viewMode 回落 month", () => {
    localStorage.setItem(
      "freeanima.calendar.uiPrefs",
      JSON.stringify({ expandRecurrence: true, viewMode: "year", kinds: ["event"] }),
    );
    expect(readCalendarUiPrefs().viewMode).toBe("month");
  });

  test("旧扁平 prefs 迁移到 byView", () => {
    localStorage.setItem(
      "freeanima.calendar.uiPrefs",
      JSON.stringify({ expandRecurrence: true, viewMode: "month", kinds: ["event"] }),
    );
    const prefs = readCalendarUiPrefs();
    expect(prefs.byView.month.kinds).toEqual(["event"]);
    expect(prefs.byView.month.builtinSources).toEqual([
      "cn_holiday",
      "traditional",
      "international",
      "solar_term",
    ]);
  });

  test("可清空当前视图 builtinSources", () => {
    writeCalendarUiPrefs({ currentView: { builtinSources: [] } });
    expect(currentViewDisplay(readCalendarUiPrefs()).builtinSources).toEqual([]);
  });

  test("按视图独立 showCompleted 默认", () => {
    const prefs = readCalendarUiPrefs();
    expect(prefs.byView.day.showCompleted).toBe(true);
    expect(prefs.byView.month.showCompleted).toBe(false);
  });

  test("isAgendaViewMode", () => {
    expect(isAgendaViewMode("day")).toBe(true);
    expect(isAgendaViewMode("next3")).toBe(true);
    expect(isAgendaViewMode("week")).toBe(false);
    expect(isAgendaViewMode("month")).toBe(false);
  });
});
