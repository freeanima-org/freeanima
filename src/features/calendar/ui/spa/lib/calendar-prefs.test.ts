import { afterEach, describe, expect, it } from "bun:test";

import {
  readCalendarUiPrefs,
  readExpandRecurrence,
  resetCalendarPrefsForTest,
  writeCalendarUiPrefs,
  writeExpandRecurrence,
} from "./calendar-prefs.ts";

describe("calendar-prefs", () => {
  afterEach(() => {
    resetCalendarPrefsForTest();
  });

  it("默认：展开重复、月视图、全部 kinds", () => {
    expect(readCalendarUiPrefs()).toEqual({
      expandRecurrence: true,
      viewMode: "month",
      kinds: ["event", "task", "project"],
    });
  });

  it("持久化重复展开开关", () => {
    writeExpandRecurrence(false);
    expect(readExpandRecurrence()).toBe(false);
    writeExpandRecurrence(true);
    expect(readExpandRecurrence()).toBe(true);
  });

  it("持久化月周与 kinds（窄/宽布局共用同一偏好）", () => {
    writeCalendarUiPrefs({ viewMode: "week", kinds: ["event", "task"] });
    expect(readCalendarUiPrefs()).toEqual({
      expandRecurrence: true,
      viewMode: "week",
      kinds: ["event", "task"],
    });
    writeCalendarUiPrefs({ expandRecurrence: false });
    expect(readCalendarUiPrefs()).toEqual({
      expandRecurrence: false,
      viewMode: "week",
      kinds: ["event", "task"],
    });
  });

  it("kinds 为空时回退默认全选", () => {
    writeCalendarUiPrefs({ kinds: [] });
    expect(readCalendarUiPrefs().kinds).toEqual(["event", "task", "project"]);
  });
});
