import { useCallback, useRef, type MouseEvent, type TouchEvent } from "react";

export type LongPressCoords = { x: number; y: number };

export type UseLongPressOptions = {
  enabled: boolean;
  onTrigger: (coords: LongPressCoords) => void;
  delayMs?: number;
};

export type LongPressHandlers = {
  onTouchStart: (e: TouchEvent) => void;
  onTouchEnd: () => void;
  onTouchMove: () => void;
  onContextMenu: (e: MouseEvent) => void;
};

/** 触摸长按触发；指针设备上仍可通过右键触发同一回调 */
export function useLongPress({
  enabled,
  onTrigger,
  delayMs = 480,
}: UseLongPressOptions): LongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coordsRef = useRef<LongPressCoords>({ x: 0, y: 0 });

  const clear = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;
      const touch = e.touches[0];
      coordsRef.current = { x: touch?.clientX ?? 0, y: touch?.clientY ?? 0 };
      clear();
      timerRef.current = setTimeout(() => onTrigger(coordsRef.current), delayMs);
    },
    [enabled, clear, delayMs, onTrigger],
  );

  const onContextMenu = useCallback(
    (e: MouseEvent) => {
      if (!enabled) return;
      e.preventDefault();
      onTrigger({ x: e.clientX, y: e.clientY });
    },
    [enabled, onTrigger],
  );

  return {
    onTouchStart,
    onTouchEnd: clear,
    onTouchMove: clear,
    onContextMenu,
  };
}
