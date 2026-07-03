import { describe, expect, test } from "bun:test";

import {
  computeLayoutShrink,
  computeVisualViewportInset,
  mergeKeyboardInset,
} from "./keyboard-inset.ts";

describe("computeVisualViewportInset", () => {
  test("无键盘时 inset 为 0", () => {
    const vv = { height: 800, offsetTop: 0 } as VisualViewport;
    expect(computeVisualViewportInset(vv, 800)).toBe(0);
  });

  test("键盘弹出时 inset 为正", () => {
    const vv = { height: 500, offsetTop: 0 } as VisualViewport;
    expect(computeVisualViewportInset(vv, 800)).toBe(300);
  });

  test("offsetTop 大于 0 时计入 inset", () => {
    const vv = { height: 700, offsetTop: 50 } as VisualViewport;
    expect(computeVisualViewportInset(vv, 800)).toBe(50);
  });
});

describe("computeLayoutShrink", () => {
  test("布局未收缩时为 0", () => {
    expect(computeLayoutShrink(800, 800)).toBe(0);
  });

  test("布局随键盘收缩", () => {
    expect(computeLayoutShrink(800, 500)).toBe(300);
  });
});

describe("mergeKeyboardInset", () => {
  test("visual inset 大于 0 时优先使用", () => {
    expect(mergeKeyboardInset(120, 300, 0)).toBe(120);
  });

  test("visual inset 为 0 时使用 native 高度", () => {
    expect(mergeKeyboardInset(0, 280, 0)).toBe(280);
  });

  test("WebView 已收缩时不再手动顶起（防双重补偿）", () => {
    expect(mergeKeyboardInset(0, 300, 300)).toBe(0);
  });

  test("部分收缩时仅补偿差额", () => {
    expect(mergeKeyboardInset(0, 300, 200)).toBe(100);
  });

  test("visual inset 扣除已收缩高度", () => {
    expect(mergeKeyboardInset(50, 0, 40)).toBe(10);
  });

  test("两者均为 0 时返回 0", () => {
    expect(mergeKeyboardInset(0, 0, 0)).toBe(0);
  });
});
