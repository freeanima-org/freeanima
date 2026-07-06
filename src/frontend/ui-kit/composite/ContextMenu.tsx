import { useEffect } from "react";

import type { ActionSheetItem } from "./types.ts";

export type ContextMenuProps = {
  x: number;
  y: number;
  items: ActionSheetItem[];
  onClose: () => void;
};

function runMenuItemAction(onClick: () => void, onClose: () => void) {
  onClose();
  // 延后执行，避免同一次 click 被 Radix Sheet/Dialog 判为「外部点击」而立刻关闭
  queueMicrotask(onClick);
}

/** 精确指针下的浮动右键菜单（触摸主输入请用 ActionSheet） */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  useEffect(() => {
    const close = () => onClose();
    // 延后注册，避免打开菜单的 click 立刻触发关闭
    const clickTimer = window.setTimeout(() => {
      window.addEventListener("click", close);
    }, 0);
    window.addEventListener("scroll", close, true);
    window.addEventListener("contextmenu", close);
    return () => {
      window.clearTimeout(clickTimer);
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("contextmenu", close);
    };
  }, [onClose]);

  return (
    <div
      className="bg-background border fixed z-50 min-w-[140px] rounded-lg border py-1 shadow-xl"
      style={{ top: y, left: x }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className={`hover:bg-muted block w-full px-3 py-1.5 text-left text-sm ${
            item.danger ? "text-destructive" : ""
          }`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            runMenuItemAction(item.onClick, onClose);
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
