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
  // 菜单卸载后再打开 Dialog/Sheet，避免 window click 监听器或 outside 判定立刻 dismiss
  window.setTimeout(onClick, 0);
}

/** 精确指针下的浮动右键菜单（触摸主输入请用 ActionSheet） */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  useEffect(() => {
    const close = () => onClose();
    // 延后注册：避免「右键打开」同一轮 contextmenu 冒泡到 window 时立刻被关掉
    const armTimer = window.setTimeout(() => {
      window.addEventListener("click", close);
      window.addEventListener("contextmenu", close);
    }, 0);
    window.addEventListener("scroll", close, true);
    return () => {
      window.clearTimeout(armTimer);
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
      window.removeEventListener("scroll", close, true);
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
