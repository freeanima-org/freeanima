export function computeVisualViewportInset(
  vv: VisualViewport,
  innerHeight = typeof window !== "undefined" ? window.innerHeight : 0,
): number {
  return Math.max(0, innerHeight - vv.height - vv.offsetTop);
}

/**
 * 合并 visual / native 键盘高度，并扣除 WebView 已随键盘收缩的布局高度，
 * 避免 adjustResize + resizeOnFullScreen 与 translateY 双重顶起。
 */
export function mergeKeyboardInset(
  vvInset: number,
  nativeHeight: number,
  layoutShrink: number,
): number {
  const rawInset = vvInset > 0 ? vvInset : nativeHeight;
  if (rawInset <= 0) return 0;
  return Math.max(0, rawInset - layoutShrink);
}

export function computeLayoutShrink(baselineInnerHeight: number, innerHeight: number): number {
  return Math.max(0, baselineInnerHeight - innerHeight);
}
