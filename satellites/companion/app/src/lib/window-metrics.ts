/** 与 tauri.conf.json 中 pet 窗口尺寸保持一致 */
export const COMPANION_WINDOW_WIDTH = 160;
export const COMPANION_WINDOW_HEIGHT = 220;

/** 浏览器 dev 模式下的桌宠视口尺寸 */
export const WEB_PET_WIDTH = COMPANION_WINDOW_WIDTH;
export const WEB_PET_HEIGHT = COMPANION_WINDOW_HEIGHT;

export type ScreenPoint = { x: number; y: number };

type ScreenRect = {
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
};

type WindowSize = {
  width: number;
  height: number;
};

/** 读取当前显示器工作区（兼容缺少 availLeft/Top 的类型定义） */
export function readScreenWorkArea(): ScreenRect {
  const screenObj = window.screen as Screen & { availLeft?: number; availTop?: number };
  return {
    availLeft: screenObj.availLeft ?? 0,
    availTop: screenObj.availTop ?? 0,
    availWidth: screenObj.availWidth,
    availHeight: screenObj.availHeight,
  };
}

/** 沿工作区外缘四角顺时针巡逻：左上 → 右上 → 右下 → 左下 */
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
