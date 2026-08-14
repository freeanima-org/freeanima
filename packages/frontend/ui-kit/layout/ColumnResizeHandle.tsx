import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

import { cn } from "../lib/cn.ts";

export type ColumnResizeHandleProps = {
  onResize: (deltaX: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  className?: string;
  ariaLabel?: string;
};

export function ColumnResizeHandle({
  onResize,
  onResizeStart,
  onResizeEnd,
  className,
  ariaLabel = "调整列宽",
}: ColumnResizeHandleProps) {
  const onResizeRef = useRef(onResize);
  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);
      onResizeStart?.();
      let lastX = e.clientX;

      const onPointerMove = (ev: PointerEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        const delta = ev.clientX - lastX;
        lastX = ev.clientX;
        if (delta !== 0) onResizeRef.current(delta);
      };

      const end = (ev: PointerEvent) => {
        target.releasePointerCapture(ev.pointerId);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
        onResizeEnd?.();
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    },
    [onResizeStart, onResizeEnd],
  );

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      data-column-resize="true"
      className={cn(
        "relative z-20 w-1 shrink-0 touch-none select-none",
        "before:absolute before:inset-y-0 before:-left-1.5 before:w-4",
        "hover:bg-border/80 active:bg-border",
        className,
      )}
      style={{ cursor: "col-resize" }}
      onPointerDown={onPointerDown}
    />
  );
}
