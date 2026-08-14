import { describe, expect, test } from "bun:test";

import { shouldRemindChatUnreadRise } from "./lib/chat-unread-remind.ts";

describe("shouldRemindChatUnreadRise", () => {
  test("首拉未 primed 不提醒", () => {
    expect(shouldRemindChatUnreadRise({ primed: false, prev: null, next: 2 })).toBe(false);
  });

  test("primed 后首次写入 prev 不提醒", () => {
    expect(shouldRemindChatUnreadRise({ primed: true, prev: null, next: 1 })).toBe(false);
  });

  test("上升提醒", () => {
    expect(shouldRemindChatUnreadRise({ primed: true, prev: 1, next: 2 })).toBe(true);
  });

  test("持平/下降不提醒", () => {
    expect(shouldRemindChatUnreadRise({ primed: true, prev: 2, next: 2 })).toBe(false);
    expect(shouldRemindChatUnreadRise({ primed: true, prev: 2, next: 1 })).toBe(false);
  });
});
