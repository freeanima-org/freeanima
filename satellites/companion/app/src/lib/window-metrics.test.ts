import { describe, expect, test } from "bun:test";
import {
  buildPerimeterWaypoints,
  COMPANION_WINDOW_HEIGHT,
  COMPANION_WINDOW_WIDTH,
} from "./window-metrics.ts";

describe("buildPerimeterWaypoints", () => {
  test("沿工作区四角生成顺时针路径", () => {
    const screen = { availLeft: 0, availTop: 0, availWidth: 1920, availHeight: 1040 };
    const window = { width: COMPANION_WINDOW_WIDTH, height: COMPANION_WINDOW_HEIGHT };
    const points = buildPerimeterWaypoints(screen, window);

    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 1920 - COMPANION_WINDOW_WIDTH, y: 0 },
      { x: 1920 - COMPANION_WINDOW_WIDTH, y: 1040 - COMPANION_WINDOW_HEIGHT },
      { x: 0, y: 1040 - COMPANION_WINDOW_HEIGHT },
    ]);
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + window.width).toBeLessThanOrEqual(screen.availWidth);
      expect(p.y + window.height).toBeLessThanOrEqual(screen.availHeight);
    }
  });

  test("小屏幕至少返回一个合法点", () => {
    const points = buildPerimeterWaypoints(
      { availLeft: 0, availTop: 0, availWidth: 120, availHeight: 180 },
      { width: COMPANION_WINDOW_WIDTH, height: COMPANION_WINDOW_HEIGHT },
    );
    expect(points).toHaveLength(1);
    expect(points[0]).toEqual({ x: 0, y: 0 });
  });
});
