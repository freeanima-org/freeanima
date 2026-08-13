import type {
  CSSProperties,
  ElementType,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  ReactNode,
  Ref,
} from "react";

import { Button } from "../components/ui/button.tsx";
import { cn } from "../lib/cn.ts";
import { ContextMenu } from "./ContextMenu.tsx";
import type { ActionSheetItem } from "./types.ts";
import { useLongPress } from "./useLongPress.ts";

export type ListRowProps = {
  as?: "li" | "div" | undefined;
  active?: boolean | undefined;
  selected?: boolean | undefined;
  disabled?: boolean | undefined;
  selectionMode?: boolean | undefined;
  dragging?: boolean | undefined;
  useActionSheet: boolean;
  /** 覆盖默认 selected 视觉（侧栏等用 tint 而非 inset ring） */
  selectedClassName?: string | undefined;
  contextMenuItems?: ActionSheetItem[] | undefined;
  contextMenuEnabled?: boolean | undefined;
  longPressEnabled?: boolean | undefined;
  onLongPress?: (() => void) | undefined;
  onOpenMenu?: (() => void) | undefined;
  menuAriaLabel?: string | undefined;
  /** 默认：useActionSheet && !selectionMode */
  showPersistentMenu?: boolean | undefined;
  dragAttributes?: object | undefined;
  dragListeners?: object | undefined;
  rowRef?: Ref<HTMLElement | null> | undefined;
  rowStyle?: CSSProperties | undefined;
  className?: string | undefined;
  onClick?: ((e: ReactMouseEvent<HTMLElement>) => void) | undefined;
  onDoubleClick?: ((e: ReactMouseEvent<HTMLElement>) => void) | undefined;
  leading?: ReactNode | undefined;
  children: ReactNode;
  /** 绝对定位叠加层（如 DnD 指示线） */
  overlays?: ReactNode | undefined;
};

/**
 * DataListRow 通用底盘：选中/激活/拖拽态、leading、持久 ⋯、ContextMenu / 长按。
 * 领域行（任务、项目侧栏等）填 slots，勿再复制 min-h-11 + 菜单样板。
 */
export function ListRow({
  as = "li",
  active = false,
  selected = false,
  disabled = false,
  selectionMode = false,
  dragging = false,
  useActionSheet,
  selectedClassName,
  contextMenuItems,
  contextMenuEnabled = false,
  longPressEnabled = false,
  onLongPress,
  onOpenMenu,
  menuAriaLabel = "操作",
  showPersistentMenu,
  dragAttributes,
  dragListeners,
  rowRef,
  rowStyle,
  className,
  onClick,
  onDoubleClick,
  leading,
  children,
  overlays,
}: ListRowProps) {
  const longPress = useLongPress({
    enabled: longPressEnabled && useActionSheet && !selectionMode,
    onTrigger: () => onLongPress?.(),
  });

  const canDrag = dragListeners != null && !selectionMode && !disabled;
  const pointerMenu =
    contextMenuEnabled && !useActionSheet && !selectionMode && (contextMenuItems?.length ?? 0) > 0;
  const showMenu = showPersistentMenu ?? (useActionSheet && !selectionMode && onOpenMenu != null);

  const Comp = as as ElementType;
  const row: ReactElement = (
    <Comp
      ref={rowRef}
      style={rowStyle}
      role={selectionMode ? "option" : undefined}
      aria-selected={selectionMode ? selected : undefined}
      className={cn(
        "hover:bg-muted group relative flex min-h-11 items-center gap-1 rounded-lg px-1 py-1",
        canDrag ? "touch-pan-y cursor-grab active:cursor-grabbing select-none" : "",
        selectionMode ? "cursor-pointer select-none" : "",
        dragging ? "opacity-50" : "",
        selected ? (selectedClassName ?? "bg-primary/20 ring-primary/40 ring-1 ring-inset") : "",
        active && !selected ? "ring-primary/30 bg-primary/5 ring-1 ring-inset" : "",
        className,
      )}
      onContextMenu={useActionSheet && !selectionMode ? longPress.onContextMenu : undefined}
      onTouchStart={longPress.onTouchStart}
      onTouchEnd={longPress.onTouchEnd}
      onTouchMove={longPress.onTouchMove}
      onTouchCancel={longPress.onTouchEnd}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      {...(canDrag && dragAttributes ? dragAttributes : {})}
      {...(canDrag && dragListeners ? dragListeners : {})}
    >
      {overlays}
      {leading}
      {children}
      {showMenu ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label={menuAriaLabel}
          {...(disabled !== undefined ? { disabled } : {})}
          onPointerDown={(e: ReactPointerEvent) => e.stopPropagation()}
          onClick={(e: ReactMouseEvent) => {
            e.stopPropagation();
            onOpenMenu?.();
          }}
        >
          ⋯
        </Button>
      ) : null}
    </Comp>
  );

  if (pointerMenu && contextMenuItems) {
    return <ContextMenu items={contextMenuItems}>{row}</ContextMenu>;
  }
  return row;
}
