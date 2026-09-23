import { useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { advanceBubbleLocal } from "@freeanima/ui-features/companion/ui/spa/lib/runtime-local.ts";
import { navigateMainRoute } from "@freeanima/ui-features/companion/ui/spa/lib/portal-shell.ts";
import { useRemoteToolsHost } from "@freeanima/ui-features/companion/ui/spa/hooks/useRemoteToolsHost.ts";
import { useCompanionStore } from "@freeanima/ui-features/companion/ui/spa/stores/companion.ts";

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
  const bubbleRef = useRef<HTMLDivElement>(null);
  const lastAnchorRef = useRef<{ x: number; y: number } | null>(null);
  const visibleRef = useRef(false);

  // 模型未就绪也要 attach，否则 Agent tool.call 无宿主
  useRemoteToolsHost(true);

  /** 气泡体：有跳转目标则驱动主窗，然后前移到下一条。 */
  const onBubbleBodyClick = useCallback(() => {
    const link = useCompanionStore.getState().runtimeBubble?.link ?? null;
    if (link) void navigateMainRoute(link);
    advanceBubbleLocal();
  }, []);

  /** × 关闭：只关闭当前一条（显示下一条），不跳转。 */
  const onCloseClick = useCallback(() => {
    advanceBubbleLocal();
  }, []);

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
      const el = bubbleRef.current;
      if (el) el.style.visibility = "hidden";
      return () => {};
    }

    let raf = 0;
    const tick = (): void => {
      const el = bubbleRef.current;
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

  const hasLink = bubble.link != null;
  const bodyTitle = hasLink
    ? pending > 1
      ? `点击打开对应内容 · 还有 ${pending - 1} 条`
      : "点击打开对应内容"
    : pending > 1
      ? `还有 ${pending - 1} 条，点击下一条`
      : "点击下一条";

  return (
    <div
      ref={bubbleRef}
      className="companion-text-bubble"
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        transform: "translate(-50%, -100%)",
        zIndex: 20,
        visibility: "hidden",
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="companion-text-bubble-body"
        onClick={onBubbleBodyClick}
        title={bodyTitle}
      >
        <span className="block text-xs leading-relaxed whitespace-pre-wrap">{bubble.text}</span>
        {pending > 1 ? (
          <span className="block text-[10px] text-white/50 mt-1">
            还有 {pending - 1} 条 · 点击切换
          </span>
        ) : null}
        {hasLink ? (
          <span className="block text-[10px] text-white/50 mt-1">点击打开对应内容</span>
        ) : null}
      </button>
      <button
        type="button"
        className="companion-text-bubble-close"
        aria-label="关闭当前通知"
        title="关闭"
        onClick={onCloseClick}
      >
        <X aria-hidden="true" />
      </button>
    </div>
  );
}
