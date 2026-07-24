import type { ReactElement } from "react";

import {
  ContextMenu as ContextMenuRoot,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "../components/ui/context-menu.tsx";
import type { ActionSheetItem } from "./types.ts";

export type ContextMenuProps = {
  /** 与 ActionSheet 共享的菜单项；disabled 或空列表时仅渲染 children */
  items: ActionSheetItem[];
  disabled?: boolean;
  children: ReactElement;
};

function runMenuItemAction(onClick: () => void) {
  // 菜单卸载后再打开 Dialog/Sheet，避免 outside 判定立刻 dismiss
  window.setTimeout(onClick, 0);
}

/**
 * 精确指针下的浮动右键菜单（触摸主输入请用 ActionSheet）。
 * 基于 Radix Context Menu（自带视口碰撞规避）；勿再自研 fixed+坐标定位。
 */
export function ContextMenu({ items, disabled = false, children }: ContextMenuProps) {
  if (disabled || items.length === 0) return children;

  return (
    <ContextMenuRoot>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {items.map((item) => (
          <ContextMenuItem
            key={item.label}
            variant={item.danger ? "destructive" : "default"}
            onSelect={() => runMenuItemAction(item.onClick)}
          >
            {item.label}
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenuRoot>
  );
}
