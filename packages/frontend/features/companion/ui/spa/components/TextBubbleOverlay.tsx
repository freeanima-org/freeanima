import { useEffect, useRef } from "react";
import { advanceBubbleLocal } from "@freeanima/features/companion/ui/spa/lib/runtime-local.ts";
import { useRemoteToolsHost } from "@freeanima/features/companion/ui/spa/hooks/useRemoteToolsHost.ts";
import { useCompanionStore } from "@freeanima/features/companion/ui/spa/stores/companion.ts";

function advanceBubbleOnClick(): void {
  advanceBubbleLocal();
}

const EDGE_MARGIN = 8;
/** 位置变化小于该值不写 DOM，减少布局抖动 */
const ANCHOR_EPS_PX = 0.75;

function clampBubbleAnchor(el: HTMLElement, x: number, y: number): { x: number; y: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  const r = el.getBoundingClientRect();
  let nx = x;
  let ny = y;
  if (r.left < EDGE_MARGIN) nx += EDGE_MARGIN - r.left;
  if (r.right > vw - EDGE_MARGIN) nx -= r.right - (vw - EDGE_MARGIN);
  if (r.top < EDGE_MARGIN) ny += EDGE_MARGIN - r.top;
  if (r.bottom > vh - EDGE_MARGIN) ny -= r.bottom - (vh - EDGE_MARGIN);
  return { x: nx, y: ny };
}

export function TextBubbleOverlay() {
  const bubble = useCompanionStore((s) => s.runtimeBubble);
  const pending = useCompanionStore((s) => s.runtimeBubblePending);
  const characterReady = useCompanionStore((s) => s.characterReady);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const lastAnchorRef = useRef<{ x: number; y: number } | null>(null);
  const visibleRef = useRef(false);

  // 模型未就绪也要 attach，否则 Agent tool.call 无宿主
  useRemoteToolsHost(true);

  useEffect(() => {
    const backend = useCompanionStore.getState().backendRef.current;
    const tracking = Boolean(bubble && characterReady);
    backend?.setBubbleTracking?.(tracking);
    return () => {
      backend?.setBubbleTracking?.(false);
    };
  }, [bubble, characterReady]);

  useEffect(() => {
    if (!bubble || !characterReady) {
      visibleRef.current = false;
      lastAnchorRef.current = null;
      const el = buttonRef.current;
      if (el) el.style.visibility = "hidden";
      return () => {};
    }

    let raf = 0;
    const tick = (): void => {
      const el = buttonRef.current;
      const backend = useCompanionStore.getState().backendRef.current;
      const head = backend?.getHeadScreenPosition?.() ?? null;
      if (el && head) {
        const prev = lastAnchorRef.current;
        if (
          !prev ||
          Math.abs(prev.x - head.x) > ANCHOR_EPS_PX ||
          Math.abs(prev.y - head.y) > ANCHOR_EPS_PX ||
          !visibleRef.current
        ) {
          const { x, y } = clampBubbleAnchor(el, head.x, head.y);
          el.style.left = `${x}px`;
          el.style.top = `${y}px`;
          el.style.visibility = "visible";
          lastAnchorRef.current = { x, y };
          visibleRef.current = true;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bubble, characterReady]);

  if (!bubble) return null;

  return (
    <button
      ref={buttonRef}
      type="button"
      className="companion-text-bubble"
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        transform: "translate(-50%, -100%)",
        zIndex: 20,
        visibility: "hidden",
      }}
      onClick={advanceBubbleOnClick}
      onPointerDown={(e) => e.stopPropagation()}
      title={pending > 1 ? `还有 ${pending - 1} 条，点击下一条` : "点击下一条"}
    >
      <span className="block text-xs leading-relaxed whitespace-pre-wrap">{bubble.text}</span>
      {pending > 1 ? (
        <span className="block text-[10px] text-white/50 mt-1">
          还有 {pending - 1} 条 · 点击切换
        </span>
      ) : null}
    </button>
  );
}
