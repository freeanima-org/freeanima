import { useCallback, useRef, type ReactNode } from "react";

type MessageMenuCoords = { x: number; y: number };

type LongPressHandlers = {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onTouchMove: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
};

function useLongPress(
  onLongPress: (coords: MessageMenuCoords) => void,
  delayMs = 480,
): LongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coordsRef = useRef<MessageMenuCoords>({ x: 0, y: 0 });

  const clear = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return {
    onTouchStart: (e) => {
      const touch = e.touches[0];
      coordsRef.current = { x: touch?.clientX ?? 0, y: touch?.clientY ?? 0 };
      clear();
      timerRef.current = setTimeout(() => onLongPress(coordsRef.current), delayMs);
    },
    onTouchEnd: clear,
    onTouchMove: clear,
    onContextMenu: (e) => {
      e.preventDefault();
      onLongPress({ x: e.clientX, y: e.clientY });
    },
  };
}

type ChatMessageBubbleProps = {
  align: "start" | "end";
  className: string;
  children: ReactNode;
  onLongPress?: (coords: MessageMenuCoords) => void;
};

export function ChatMessageBubble({
  align,
  className,
  children,
  onLongPress,
}: ChatMessageBubbleProps) {
  const longPress = useLongPress((coords) => onLongPress?.(coords));

  return (
    <div className={`flex min-w-0 max-w-full ${align === "end" ? "justify-end" : "justify-start"}`}>
      <div
        className={`chat-bubble min-w-0 max-w-full ${className}`}
        {...(onLongPress ? longPress : {})}
      >
        {children}
      </div>
    </div>
  );
}

export function findLastUserMessageIndex(display: Array<{ type: string; role?: string }>): number {
  for (let i = display.length - 1; i >= 0; i--) {
    const item = display[i];
    if (item?.type === "message" && item.role === "user") return i;
  }
  return -1;
}
