import { useEffect } from "react";

import type { TaskMenuItem } from "../lib/menu-types.ts";

export type ContextMenuItem = TaskMenuItem;

type ContextMenuProps = {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
};

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
      className="bg-base-100 border-base-300 fixed z-50 min-w-[140px] rounded-lg border py-1 shadow-xl"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className={`hover:bg-base-200 block w-full px-3 py-1.5 text-left text-sm ${
            item.danger ? "text-error" : ""
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
