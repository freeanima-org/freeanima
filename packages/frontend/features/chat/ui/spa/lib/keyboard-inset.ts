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

/**
 * compact 底栏仍在文档流时，compose 相对布局底已高出一截底栏；
 * translateY 若仍用全量 keyboardInset，会多抬底栏高度，在输入与键盘之间留下透明空隙。
 */
export function composeKeyboardLift(keyboardInset: number, bottomChromePx: number): number {
  if (keyboardInset <= 0) return 0;
  return Math.max(0, keyboardInset - Math.max(0, bottomChromePx));
}

/** 测量 AppFrame compact 底栏占位（含 safe-area）；无底栏时为 0 */
export function measureAppBottomNavChromePx(root?: ParentNode): number {
  const scope = root ?? (typeof document !== "undefined" ? document : undefined);
  if (!scope) return 0;
  const nav = scope.querySelector(".app-bottom-nav");
  if (!nav || typeof nav.getBoundingClientRect !== "function") return 0;
  return nav.getBoundingClientRect().height;
}
