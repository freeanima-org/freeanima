import { describe, expect, test } from "bun:test";

import {
  composeKeyboardLift,
  computeLayoutShrink,
  computeVisualViewportInset,
  KEYBOARD_IMMERSIVE_CLOSE_PX,
  KEYBOARD_IMMERSIVE_OPEN_PX,
  KEYBOARD_INSET_NOISE_FLOOR_PX,
  measureAppBottomNavChromePx,
  mergeKeyboardInset,
  shouldOwnCompactImmersiveForKeyboard,
  stabilizeKeyboardInset,
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

describe("stabilizeKeyboardInset", () => {
  test("噪声地板以下抹零", () => {
    expect(stabilizeKeyboardInset(KEYBOARD_INSET_NOISE_FLOOR_PX - 1)).toBe(0);
    expect(stabilizeKeyboardInset(20)).toBe(0);
  });

  test("达到噪声地板时保留", () => {
    expect(stabilizeKeyboardInset(KEYBOARD_INSET_NOISE_FLOOR_PX)).toBe(
      KEYBOARD_INSET_NOISE_FLOOR_PX,
    );
    expect(stabilizeKeyboardInset(300)).toBe(300);
  });
});

describe("shouldOwnCompactImmersiveForKeyboard", () => {
  test("伪 inset 不得打开沉浸", () => {
    expect(shouldOwnCompactImmersiveForKeyboard(20, false)).toBe(false);
    expect(shouldOwnCompactImmersiveForKeyboard(KEYBOARD_IMMERSIVE_OPEN_PX - 1, false)).toBe(false);
  });

  test("真实键盘高度打开沉浸", () => {
    expect(shouldOwnCompactImmersiveForKeyboard(KEYBOARD_IMMERSIVE_OPEN_PX, false)).toBe(true);
    expect(shouldOwnCompactImmersiveForKeyboard(300, false)).toBe(true);
  });

  test("滞回：已占用时小幅抖动不释放", () => {
    expect(shouldOwnCompactImmersiveForKeyboard(80, true)).toBe(true);
    expect(shouldOwnCompactImmersiveForKeyboard(KEYBOARD_IMMERSIVE_CLOSE_PX + 1, true)).toBe(true);
  });

  test("滞回：落到关闭阈值才释放", () => {
    expect(shouldOwnCompactImmersiveForKeyboard(KEYBOARD_IMMERSIVE_CLOSE_PX, true)).toBe(false);
    expect(shouldOwnCompactImmersiveForKeyboard(0, true)).toBe(false);
  });

  test("伪 inset 在开/关两侧抖动不得反复 toggle", () => {
    let owned = false;
    for (const inset of [0, 20, 56, 0, 40, 10, 0]) {
      const next = shouldOwnCompactImmersiveForKeyboard(inset, owned);
      expect(next).toBe(false);
      owned = next;
    }
  });
});

describe("composeKeyboardLift", () => {
  test("无键盘时为 0", () => {
    expect(composeKeyboardLift(0, 56)).toBe(0);
  });

  test("扣除 compact 底栏占位，避免多抬透明空隙", () => {
    expect(composeKeyboardLift(300, 56)).toBe(244);
  });

  test("底栏已隐藏时用全量 inset", () => {
    expect(composeKeyboardLift(300, 0)).toBe(300);
  });

  test("底栏高于 inset 时不负向平移", () => {
    expect(composeKeyboardLift(40, 56)).toBe(0);
  });
});

describe("measureAppBottomNavChromePx", () => {
  test("无底栏节点时为 0", () => {
    const root = {
      querySelector: () => null,
    } as unknown as ParentNode;
    expect(measureAppBottomNavChromePx(root)).toBe(0);
  });

  test("按底栏 getBoundingClientRect().height", () => {
    const nav = {
      getBoundingClientRect: () => ({ height: 64 }),
    };
    const root = {
      querySelector: (sel: string) => (sel === ".app-bottom-nav" ? nav : null),
    } as unknown as ParentNode;
    expect(measureAppBottomNavChromePx(root)).toBe(64);
  });
});
