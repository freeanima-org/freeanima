import { afterEach, describe, expect, test } from "bun:test";

import {
  getCompactImmersive,
  resetCompactImmersiveForTest,
  setCompactImmersive,
  subscribeCompactImmersive,
} from "./compact-immersive-store.ts";

afterEach(() => {
  resetCompactImmersiveForTest();
});

describe("compact-immersive-store", () => {
  test("default false；set 后可读", () => {
    expect(getCompactImmersive()).toBe(false);
    setCompactImmersive(true);
    expect(getCompactImmersive()).toBe(true);
    setCompactImmersive(false);
    expect(getCompactImmersive()).toBe(false);
  });

  test("同值不通知；变值通知", () => {
    let n = 0;
    const unsub = subscribeCompactImmersive(() => {
      n += 1;
    });
    setCompactImmersive(false);
    expect(n).toBe(0);
    setCompactImmersive(true);
    expect(n).toBe(1);
    setCompactImmersive(true);
    expect(n).toBe(1);
    unsub();
    setCompactImmersive(false);
    expect(n).toBe(1);
  });
});
