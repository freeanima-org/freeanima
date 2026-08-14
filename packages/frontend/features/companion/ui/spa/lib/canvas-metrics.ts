export function measureCharacterViewportSize(
  container: HTMLElement | null,
  canvas: HTMLCanvasElement,
): { width: number; height: number } {
  const el = container ?? canvas;
  const rect = el.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width || window.innerWidth || 1));
  const height = Math.max(1, Math.round(rect.height || window.innerHeight || 1));
  return { width, height };
}
