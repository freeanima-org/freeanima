/** 贴边折叠几何（物理像素；与 Tauri outerPosition / workArea 一致）。 */

export type DockEdge = "left" | "right" | "top" | "bottom";

export type RectPx = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SizePx = { width: number; height: number };

export const EDGE_DOCK_THRESHOLD_PX = 24;
export const COLLAPSED_THICKNESS_PX = 8;
export const COLLAPSED_LENGTH_PX = 120;
export const EXPANDED_WIDTH_PX = 220;
export const EXPANDED_HEIGHT_PX = 120;

export function expandedSize(): SizePx {
  return { width: EXPANDED_WIDTH_PX, height: EXPANDED_HEIGHT_PX };
}

export function collapsedSize(edge: DockEdge): SizePx {
  if (edge === "left" || edge === "right") {
    return { width: COLLAPSED_THICKNESS_PX, height: COLLAPSED_LENGTH_PX };
  }
  return { width: COLLAPSED_LENGTH_PX, height: COLLAPSED_THICKNESS_PX };
}

/** 窗体外框相对工作区的最近边；过远则返回 null。 */
export function detectDockEdge(
  win: RectPx,
  workArea: RectPx,
  thresholdPx: number = EDGE_DOCK_THRESHOLD_PX,
): DockEdge | null {
  const leftDist = win.x - workArea.x;
  const rightDist = workArea.x + workArea.width - (win.x + win.width);
  const topDist = win.y - workArea.y;
  const bottomDist = workArea.y + workArea.height - (win.y + win.height);

  const candidates: { edge: DockEdge; dist: number }[] = [
    { edge: "left", dist: leftDist },
    { edge: "right", dist: rightDist },
    { edge: "top", dist: topDist },
    { edge: "bottom", dist: bottomDist },
  ];

  let best: { edge: DockEdge; dist: number } | null = null;
  for (const c of candidates) {
    if (c.dist < 0 || c.dist > thresholdPx) continue;
    if (!best || c.dist < best.dist) best = c;
  }
  return best?.edge ?? null;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** 折叠条贴在指定边，沿边居中对齐当前窗的中心。 */
export function snapCollapsedFrame(edge: DockEdge, win: RectPx, workArea: RectPx): RectPx {
  const size = collapsedSize(edge);
  const cx = win.x + win.width / 2;
  const cy = win.y + win.height / 2;

  if (edge === "left") {
    return {
      x: workArea.x,
      y: clamp(cy - size.height / 2, workArea.y, workArea.y + workArea.height - size.height),
      ...size,
    };
  }
  if (edge === "right") {
    return {
      x: workArea.x + workArea.width - size.width,
      y: clamp(cy - size.height / 2, workArea.y, workArea.y + workArea.height - size.height),
      ...size,
    };
  }
  if (edge === "top") {
    return {
      x: clamp(cx - size.width / 2, workArea.x, workArea.x + workArea.width - size.width),
      y: workArea.y,
      ...size,
    };
  }
  return {
    x: clamp(cx - size.width / 2, workArea.x, workArea.x + workArea.width - size.width),
    y: workArea.y + workArea.height - size.height,
    ...size,
  };
}

/** 悬停展开：仍锚定在 dock 边，向内侧展开。 */
export function snapExpandedNearEdge(edge: DockEdge, collapsed: RectPx, workArea: RectPx): RectPx {
  const size = expandedSize();
  if (edge === "left") {
    return {
      x: workArea.x,
      y: clamp(
        collapsed.y + collapsed.height / 2 - size.height / 2,
        workArea.y,
        workArea.y + workArea.height - size.height,
      ),
      ...size,
    };
  }
  if (edge === "right") {
    return {
      x: workArea.x + workArea.width - size.width,
      y: clamp(
        collapsed.y + collapsed.height / 2 - size.height / 2,
        workArea.y,
        workArea.y + workArea.height - size.height,
      ),
      ...size,
    };
  }
  if (edge === "top") {
    return {
      x: clamp(
        collapsed.x + collapsed.width / 2 - size.width / 2,
        workArea.x,
        workArea.x + workArea.width - size.width,
      ),
      y: workArea.y,
      ...size,
    };
  }
  return {
    x: clamp(
      collapsed.x + collapsed.width / 2 - size.width / 2,
      workArea.x,
      workArea.x + workArea.width - size.width,
    ),
    y: workArea.y + workArea.height - size.height,
    ...size,
  };
}

export function progressRatio(remainingMs: number, plannedMs: number): number {
  if (plannedMs <= 0) return 0;
  return clamp(1 - remainingMs / plannedMs, 0, 1);
}

/** 两帧足够接近则跳过 setPosition/setSize，避免程序化移动触发 onMoved 反馈环。 */
export function framesClose(a: RectPx, b: RectPx, epsilonPx: number = 1.5): boolean {
  return (
    Math.abs(a.x - b.x) <= epsilonPx &&
    Math.abs(a.y - b.y) <= epsilonPx &&
    Math.abs(a.width - b.width) <= epsilonPx &&
    Math.abs(a.height - b.height) <= epsilonPx
  );
}
