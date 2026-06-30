export {
  COMPANION_WINDOW_HEIGHT,
  COMPANION_WINDOW_WIDTH,
  SATELLITE_PORT_MAX,
  SATELLITE_PORT_START,
} from "@shared/constants.ts";

export type ScreenPoint = { x: number; y: number };

export type ScreenRect = {
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
};

type WindowSize = {
  width: number;
  height: number;
};

/** 读取当前显示器工作区（浏览器 dev；Tauri 生产环境请用 getPatrolScreen） */
export function readScreenWorkArea(): ScreenRect {
  const screenObj = window.screen as Screen & { availLeft?: number; availTop?: number };
  return {
    availLeft: screenObj.availLeft ?? 0,
    availTop: screenObj.availTop ?? 0,
    availWidth: screenObj.availWidth,
    availHeight: screenObj.availHeight,
  };
}

/** 在当前垂直高度上左右两端来回巡逻 */
export function buildHorizontalPatrolWaypoints(
  screen: ScreenRect,
  window: WindowSize,
  laneY: number,
): ScreenPoint[] {
  const minX = screen.availLeft;
  const maxX = Math.max(minX, screen.availLeft + screen.availWidth - window.width);
  const minY = screen.availTop;
  const maxY = Math.max(minY, screen.availTop + screen.availHeight - window.height);
  const y = clamp(laneY, minY, maxY);

  if (maxX <= minX) {
    return [{ x: minX, y }];
  }

  return [
    { x: minX, y },
    { x: maxX, y },
  ];
}

/** 水平巡逻时窗口左上角可移动范围（Y 固定为 laneY） */
export function patrolBoundsForHorizontal(
  screen: ScreenRect,
  window: WindowSize,
  laneY: number,
): PatrolBounds {
  const minX = screen.availLeft;
  const maxX = Math.max(minX, screen.availLeft + screen.availWidth - window.width);
  const minY = screen.availTop;
  const maxY = Math.max(minY, screen.availTop + screen.availHeight - window.height);
  const y = clamp(laneY, minY, maxY);
  return { minX, minY: y, maxX, maxY: y };
}

/** 启动归位目标：工作区左上角 */
export function buildHomeCorner(screen: ScreenRect): ScreenPoint {
  return { x: screen.availLeft, y: screen.availTop };
}

/** 沿工作区内边缘四角顺时针巡逻：左上 → 右上 → 右下 → 左下 */
export function buildPerimeterWaypoints(screen: ScreenRect, window: WindowSize): ScreenPoint[] {
  const minX = screen.availLeft;
  const minY = screen.availTop;
  const maxX = Math.max(minX, screen.availLeft + screen.availWidth - window.width);
  const maxY = Math.max(minY, screen.availTop + screen.availHeight - window.height);

  if (maxX <= minX && maxY <= minY) {
    return [{ x: minX, y: minY }];
  }

  const corners: ScreenPoint[] = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];

  return corners.filter(
    (point, index) =>
      index === 0 || point.x !== corners[index - 1]!.x || point.y !== corners[index - 1]!.y,
  );
}

/** 工作区中心（窗口左上角坐标，物理/逻辑像素与 patrol 一致） */
export function buildWorkAreaCenter(screen: ScreenRect, window: WindowSize): ScreenPoint {
  const bounds = patrolBoundsFromWaypoints(buildPerimeterWaypoints(screen, window));
  if (!bounds) {
    return { x: screen.availLeft, y: screen.availTop };
  }
  return {
    x: Math.round(bounds.minX + (bounds.maxX - bounds.minX) / 2),
    y: Math.round(bounds.minY + (bounds.maxY - bounds.minY) / 2),
  };
}

/** 巡逻路径角点索引：0=左上（归位/home） */
export const PATROL_CORNER_INDEX = {
  home: 0,
  topRight: 1,
  bottomRight: 2,
  bottomLeft: 3,
} as const;

export function patrolWaypoint(points: ScreenPoint[], index: number): ScreenPoint {
  return points[index] ?? points[0] ?? { x: 0, y: 0 };
}

export type PatrolBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/** 从四角路径推导窗口左上角可移动范围 */
export function patrolBoundsFromWaypoints(waypoints: ScreenPoint[]): PatrolBounds | null {
  if (waypoints.length === 0) return null;
  if (waypoints.length === 1) {
    const p = waypoints[0]!;
    return { minX: p.x, minY: p.y, maxX: p.x, maxY: p.y };
  }
  const minX = waypoints[0]!.x;
  const minY = waypoints[0]!.y;
  const maxX = waypoints[1]!.x;
  const maxY = waypoints[2]?.y ?? waypoints.at(-1)!.y;
  return { minX, minY, maxX, maxY };
}

export function clampPatrolPosition(point: ScreenPoint, bounds: PatrolBounds | null): ScreenPoint {
  if (!bounds) return point;
  return {
    x: Math.round(Math.min(bounds.maxX, Math.max(bounds.minX, point.x))),
    y: Math.round(Math.min(bounds.maxY, Math.max(bounds.minY, point.y))),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 从当前位置投影到矩形工作区边缘，得到进入巡逻的落点与下一段角点索引 */
export function nearestPerimeterEntry(
  position: ScreenPoint,
  waypoints: ScreenPoint[],
): { entry: ScreenPoint; nextIndex: number } {
  if (waypoints.length === 0) {
    return { entry: { x: 0, y: 0 }, nextIndex: 0 };
  }
  if (waypoints.length === 1) {
    return { entry: waypoints[0]!, nextIndex: 0 };
  }

  const bounds = patrolBoundsFromWaypoints(waypoints);
  if (!bounds) {
    return { entry: waypoints[0]!, nextIndex: 0 };
  }

  const { minX, minY, maxX, maxY } = bounds;
  const candidates = [
    {
      edge: "top" as const,
      entry: { x: clamp(position.x, minX, maxX), y: minY },
    },
    {
      edge: "bottom" as const,
      entry: { x: clamp(position.x, minX, maxX), y: maxY },
    },
    {
      edge: "left" as const,
      entry: { x: minX, y: clamp(position.y, minY, maxY) },
    },
    {
      edge: "right" as const,
      entry: { x: maxX, y: clamp(position.y, minY, maxY) },
    },
  ];

  let best = candidates[0]!;
  let bestDist = Infinity;
  for (const candidate of candidates) {
    const dist = Math.hypot(position.x - candidate.entry.x, position.y - candidate.entry.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }

  const eps = 2;
  const { entry, edge } = best;
  let nextIndex: number;
  switch (edge) {
    case "top":
      nextIndex =
        entry.x >= maxX - eps ? PATROL_CORNER_INDEX.bottomRight : PATROL_CORNER_INDEX.topRight;
      break;
    case "right":
      nextIndex =
        entry.y >= maxY - eps ? PATROL_CORNER_INDEX.bottomLeft : PATROL_CORNER_INDEX.bottomRight;
      break;
    case "bottom":
      nextIndex = entry.x <= minX + eps ? PATROL_CORNER_INDEX.home : PATROL_CORNER_INDEX.bottomLeft;
      break;
    case "left":
      nextIndex = entry.y <= minY + eps ? PATROL_CORNER_INDEX.topRight : PATROL_CORNER_INDEX.home;
      break;
  }

  return { entry, nextIndex: nextIndex % waypoints.length };
}
