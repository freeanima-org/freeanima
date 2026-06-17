import { describe, expect, test } from "bun:test";
import {
  buildPerimeterWaypoints,
  COMPANION_WINDOW_HEIGHT,
  COMPANION_WINDOW_WIDTH,
  nearestPerimeterEntry,
  PATROL_CORNER_INDEX,
} from "./window-metrics.ts";

describe("buildPerimeterWaypoints", () => {
  test("沿工作区四角内边缘生成顺时针路径", () => {
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

  test("支持非零 availLeft/Top（多显示器，物理坐标）", () => {
    const screen = { availLeft: 1920, availTop: 0, availWidth: 1920, availHeight: 1080 };
    const window = { width: 320, height: 440 };
    const points = buildPerimeterWaypoints(screen, window);

    expect(points[0]).toEqual({ x: 1920, y: 0 });
    expect(points[1]).toEqual({ x: 1920 + 1920 - 320, y: 0 });
    expect(points[2]).toEqual({ x: 1920 + 1920 - 320, y: 1080 - 440 });
    expect(points[3]).toEqual({ x: 1920, y: 1080 - 440 });
  });
});

describe("nearestPerimeterEntry", () => {
  const screen = { availLeft: 0, availTop: 0, availWidth: 1920, availHeight: 1040 };
  const window = { width: COMPANION_WINDOW_WIDTH, height: COMPANION_WINDOW_HEIGHT };
  const waypoints = buildPerimeterWaypoints(screen, window);

  test("屏幕中心投影到最近边缘（下缘）", () => {
    const center = { x: 960, y: 520 };
    const { entry, nextIndex } = nearestPerimeterEntry(center, waypoints);

    expect(entry).toEqual({
      x: 960,
      y: 1040 - COMPANION_WINDOW_HEIGHT,
    });
    expect(nextIndex).toBe(PATROL_CORNER_INDEX.bottomLeft);
  });

  test("靠近左上角时落在左上并顺时针走向右上", () => {
    const nearTopLeft = { x: 40, y: 30 };
    const { entry, nextIndex } = nearestPerimeterEntry(nearTopLeft, waypoints);

    expect(entry).toEqual({ x: 40, y: 0 });
    expect(nextIndex).toBe(PATROL_CORNER_INDEX.topRight);
  });

  test("已在角点上时 nextIndex 指向下一个角", () => {
    const topRight = waypoints[PATROL_CORNER_INDEX.topRight]!;
    const { entry, nextIndex } = nearestPerimeterEntry(topRight, waypoints);

    expect(entry).toEqual(topRight);
    expect(nextIndex).toBe(PATROL_CORNER_INDEX.bottomRight);
  });
});
