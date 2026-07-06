import type { ReactNode } from "react";

import { useLongPress, type LongPressCoords } from "@freeanima/ui-kit/composite";

export type MessageMenuCoords = LongPressCoords;

type ChatMessageBubbleProps = {
  align: "start" | "end";
  className: string;
  children: ReactNode;
  onLongPress?: (coords: MessageMenuCoords) => void;
  /** 为 false 时不绑定长按/右键（精确指针下由外层提供右键菜单时使用） */
  longPressEnabled?: boolean;
};

export function ChatMessageBubble({
  align,
  className,
  children,
  onLongPress,
  longPressEnabled = true,
}: ChatMessageBubbleProps) {
  const longPress = useLongPress({
    enabled: Boolean(onLongPress) && longPressEnabled,
    onTrigger: (coords) => onLongPress?.(coords),
  });

  return (
    <div className={`flex min-w-0 max-w-full ${align === "end" ? "justify-end" : "justify-start"}`}>
      <div
        className={`chat-bubble min-w-0 max-w-full ${className}`}
        {...(onLongPress && longPressEnabled ? longPress : {})}
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
