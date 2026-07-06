import { useEffect } from "react";

import type { ActionSheetItem } from "./types.ts";

export type ContextMenuProps = {
  x: number;
  y: number;
  items: ActionSheetItem[];
  onClose: () => void;
};

/** 精确指针下的浮动右键菜单（触摸主输入请用 ActionSheet） */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("contextmenu", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("contextmenu", close);
    };
  }, [onClose]);

  return (
    <div
      className="bg-background border fixed z-50 min-w-[140px] rounded-lg border py-1 shadow-xl"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className={`hover:bg-muted block w-full px-3 py-1.5 text-left text-sm ${
            item.danger ? "text-destructive" : ""
          }`}
          onClick={() => {
            item.onClick();
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
