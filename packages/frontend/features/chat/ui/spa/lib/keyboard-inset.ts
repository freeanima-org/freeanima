export function computeVisualViewportInset(
  vv: VisualViewport,
  innerHeight = typeof window !== "undefined" ? window.innerHeight : 0,
): number {
  return Math.max(0, innerHeight - vv.height - vv.offsetTop);
}

/**
 * 全屏 WebView / 状态栏噪声常给出十几～几十 px「伪键盘 inset」。
 * 低于此值视为无键盘（compose 抬升与 immersive 均不得跟）。
 */
export const KEYBOARD_INSET_NOISE_FLOOR_PX = 24;

/**
 * 打开 compact 沉浸（藏底栏）的键盘高度下限。
 * 须明显高于底栏+safe-area，避免藏底栏改视口后再抖回 0 形成 React #185 更新环。
 */
export const KEYBOARD_IMMERSIVE_OPEN_PX = 120;

/** 已占用沉浸时，inset 落到此值及以下才释放（滞回） */
export const KEYBOARD_IMMERSIVE_CLOSE_PX = KEYBOARD_INSET_NOISE_FLOOR_PX;

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

/** 抹掉状态栏级伪 inset，避免无键盘时 translateY / immersive 误触发 */
export function stabilizeKeyboardInset(inset: number): number {
  return inset < KEYBOARD_INSET_NOISE_FLOOR_PX ? 0 : inset;
}

/**
 * 键盘是否应占用 compact 沉浸。开/关阈值分离，避免伪 inset 与底栏 DOM 互触发更新环。
 */
export function shouldOwnCompactImmersiveForKeyboard(
  keyboardInset: number,
  currentlyOwned: boolean,
): boolean {
  if (currentlyOwned) {
    return keyboardInset > KEYBOARD_IMMERSIVE_CLOSE_PX;
  }
  return keyboardInset >= KEYBOARD_IMMERSIVE_OPEN_PX;
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
