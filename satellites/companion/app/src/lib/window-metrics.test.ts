import { describe, expect, test } from "bun:test";
import {
  buildHorizontalPatrolWaypoints,
  buildPerimeterWaypoints,
  clampPatrolPosition,
  COMPANION_WINDOW_HEIGHT,
  COMPANION_WINDOW_WIDTH,
  nearestPerimeterEntry,
  PATROL_CORNER_INDEX,
  patrolBoundsForHorizontal,
  patrolBoundsFromWaypoints,
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

  test("支持非零 availLeft/Top（多显示器，逻辑坐标）", () => {
    const screen = { availLeft: 1920, availTop: 0, availWidth: 1920, availHeight: 1080 };
    const window = { width: 320, height: 440 };
    const points = buildPerimeterWaypoints(screen, window);

    expect(points[0]).toEqual({ x: 1920, y: 0 });
    expect(points[1]).toEqual({ x: 1920 + 1920 - 320, y: 0 });
    expect(points[2]).toEqual({ x: 1920 + 1920 - 320, y: 1080 - 440 });
    expect(points[3]).toEqual({ x: 1920, y: 1080 - 440 });
  });
});

describe("buildHorizontalPatrolWaypoints", () => {
  const screen = { availLeft: 0, availTop: 0, availWidth: 1920, availHeight: 1040 };
  const window = { width: COMPANION_WINDOW_WIDTH, height: COMPANION_WINDOW_HEIGHT };

  test("在当前 Y 上生成左右两端点", () => {
    const laneY = 400;
    const points = buildHorizontalPatrolWaypoints(screen, window, laneY);

    expect(points).toEqual([
      { x: 0, y: laneY },
      { x: 1920 - COMPANION_WINDOW_WIDTH, y: laneY },
    ]);
  });

  test("laneY 超出工作区时钳制到合法范围", () => {
    const maxY = 1040 - COMPANION_WINDOW_HEIGHT;
    expect(buildHorizontalPatrolWaypoints(screen, window, -100)[0]!.y).toBe(0);
    expect(buildHorizontalPatrolWaypoints(screen, window, 9999)[0]!.y).toBe(maxY);
  });

  test("patrolBoundsForHorizontal 固定 Y", () => {
    const bounds = patrolBoundsForHorizontal(screen, window, 300);
    expect(bounds).toEqual({
      minX: 0,
      minY: 300,
      maxX: 1920 - COMPANION_WINDOW_WIDTH,
      maxY: 300,
    });
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

describe("patrolBoundsFromWaypoints", () => {
  test("从四角路径推导窗口可移动矩形", () => {
    const waypoints = buildPerimeterWaypoints(
      { availLeft: 0, availTop: 0, availWidth: 1920, availHeight: 1040 },
      { width: COMPANION_WINDOW_WIDTH, height: COMPANION_WINDOW_HEIGHT },
    );
    const bounds = patrolBoundsFromWaypoints(waypoints);
    expect(bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 1920 - COMPANION_WINDOW_WIDTH,
      maxY: 1040 - COMPANION_WINDOW_HEIGHT,
    });
  });
});

describe("clampPatrolPosition", () => {
  const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 200 };

  test("超出边界时钳制到边缘", () => {
    expect(clampPatrolPosition({ x: -20, y: 250 }, bounds)).toEqual({ x: 0, y: 200 });
    expect(clampPatrolPosition({ x: 150, y: -5 }, bounds)).toEqual({ x: 100, y: 0 });
  });

  test("无 bounds 时原样返回", () => {
    const p = { x: 50, y: 80 };
    expect(clampPatrolPosition(p, null)).toEqual(p);
  });
});
