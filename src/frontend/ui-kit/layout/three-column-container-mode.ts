import type { ThreeColumnLayoutMode } from "./three-column-mode.ts";

/** 三栏区域内部宽度断点（已扣除 Shell Rail 等；与视口 768/1028 对应） */
export const THREE_COLUMN_CONTAINER_WIDE_MIN = 852;
export const THREE_COLUMN_CONTAINER_COMPACT_MAX = 479;

const DETAIL_COLUMN_MIN_PX = 220;
const RESIZE_HANDLE_PX = 4;

export function threeColumnModeForContainerWidth(width: number): ThreeColumnLayoutMode {
  if (width <= THREE_COLUMN_CONTAINER_COMPACT_MAX) return "compact";
  if (width < THREE_COLUMN_CONTAINER_WIDE_MIN) return "medium";
  return "wide";
}

export function resolveThreeColumnMode(
  containerWidth: number,
  viewportMode: ThreeColumnLayoutMode,
): ThreeColumnLayoutMode {
  // 移动壳无左 rail，容器宽度≈视口；compact 视口必须保持单列 + 详情 Sheet
  if (viewportMode === "compact") return "compact";
  // 未量到或量到异常窄时仍用视口档，避免首帧误判 compact 导致拖拽手柄不挂载
  if (containerWidth <= THREE_COLUMN_CONTAINER_COMPACT_MAX) return viewportMode;
  return threeColumnModeForContainerWidth(containerWidth);
}

export function clampListWidthForContainer(
  listWidth: number,
  middleWidth: number,
  containerWidth: number,
  limits: { min: number; max: number },
): number {
  if (containerWidth <= 0) {
    return Math.min(Math.max(listWidth, limits.min), limits.max);
  }
  const handles = RESIZE_HANDLE_PX * 2;
  const maxForContainer = containerWidth - middleWidth - DETAIL_COLUMN_MIN_PX - handles;
  return Math.min(Math.max(listWidth, limits.min), limits.max, maxForContainer);
}

export function clampMiddleWidthForContainer(
  listWidth: number,
  middleWidth: number,
  containerWidth: number,
  limits: { min: number; max: number },
  listInRow = true,
): number {
  if (containerWidth <= 0) {
    return Math.min(Math.max(middleWidth, limits.min), limits.max);
  }
  const handles = RESIZE_HANDLE_PX * 2;
  const listOccupied = listInRow ? listWidth : 0;
  const maxForContainer = containerWidth - listOccupied - DETAIL_COLUMN_MIN_PX - handles;
  return Math.min(Math.max(middleWidth, limits.min), limits.max, maxForContainer);
}
