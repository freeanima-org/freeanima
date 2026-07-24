/** Pure helpers for pull-to-refresh (unit-testable without DOM). */

export const PULL_TO_REFRESH_EDGE_IGNORE_PX = 24;
export const PULL_TO_REFRESH_THRESHOLD_PX = 64;
export const PULL_TO_REFRESH_MAX_PULL_PX = 96;

/** Ignore starts near the left edge so drawer edge-swipe still wins. */
export function shouldIgnorePullStart(
  clientX: number,
  edgeIgnorePx = PULL_TO_REFRESH_EDGE_IGNORE_PX,
): boolean {
  return clientX < edgeIgnorePx;
}

/** Only start a pull when the scroll container is already at the top. */
export function canStartPullAtScrollTop(scrollTop: number): boolean {
  return scrollTop <= 0;
}

export function clampPullDistance(dy: number, maxPullPx = PULL_TO_REFRESH_MAX_PULL_PX): number {
  if (dy <= 0) return 0;
  return Math.min(dy, maxPullPx);
}

export function shouldTriggerRefresh(
  pullDistance: number,
  thresholdPx = PULL_TO_REFRESH_THRESHOLD_PX,
): boolean {
  return pullDistance >= thresholdPx;
}

/** Mirror shell fine-pointer check without importing portal-sdk into ui-kit. */
export function detectTouchPrimaryInput(
  matchMediaFn: (query: string) => { matches: boolean } = (q) => window.matchMedia(q),
): boolean {
  const fine = matchMediaFn("(pointer: fine)").matches;
  const hover = matchMediaFn("(hover: hover)").matches;
  return !(fine && hover);
}
