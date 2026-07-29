import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactElement, Ref } from "react";

import { Button } from "../components/ui/button.tsx";
import { Checkbox } from "../components/ui/checkbox.tsx";
import { formatDue } from "../lib/datetime-local.ts";
import {
  priorityDot,
  resolveTaskTagTitles,
  type TaskItemDisplay,
} from "../lib/task-item-display.ts";
import { ContextMenu } from "./ContextMenu.tsx";
import { TaskItemTagStrip } from "./TaskItemTagStrip.tsx";
import type { ActionSheetItem } from "./types.ts";
import { useLongPress } from "./useLongPress.ts";

export type TaskItemRowViewProps = {
  item: TaskItemDisplay;
  active?: boolean;
  selected?: boolean;
  disabled?: boolean;
  selectionMode?: boolean;
  useActionSheet: boolean;
  /** pointer 路径：Context Menu 菜单项；与 ActionSheet 共享同一套构建逻辑 */
  contextMenuItems?: ActionSheetItem[] | undefined;
  contextMenuEnabled?: boolean;
  secondaryLine?: string | null;
  showEntityId?: boolean;
  /** id → 标题；用于行内展示标签（缺省不渲染标签条） */
  tagTitleById?: ReadonlyMap<number, string> | null;
  /** 整行拖拽：dnd-kit attributes + listeners（勿再用独立手柄） */
  dragAttributes?: Record<string, unknown>;
  dragListeners?: Record<string, unknown>;
  rowRef?: Ref<HTMLLIElement>;
  rowStyle?: CSSProperties;
  dragging?: boolean;
  longPressEnabled?: boolean;
  onToggleComplete: () => void;
  onEdit: () => void;
  onOpenMenu: () => void;
  onSelectItem?: (shiftKey: boolean) => void;
  onLongPress?: () => void;
};

export function TaskItemRowView({
  item,
  active = false,
  selected = false,
  disabled = false,
  selectionMode = false,
  useActionSheet,
  contextMenuItems,
  contextMenuEnabled = false,
  secondaryLine,
  showEntityId = false,
  tagTitleById = null,
  dragAttributes,
  dragListeners,
  rowRef,
  rowStyle,
  dragging = false,
  longPressEnabled = false,
  onToggleComplete,
  onEdit,
  onOpenMenu,
  onSelectItem,
  onLongPress,
}: TaskItemRowViewProps) {
  const longPress = useLongPress({
    enabled: longPressEnabled && useActionSheet && !selectionMode,
    onTrigger: () => onLongPress?.(),
  });

  const canDrag = dragListeners != null && !selectionMode && !disabled;
  const tagTitles = resolveTaskTagTitles(item.tag_ids, tagTitleById);
  const pointerMenu =
    contextMenuEnabled && !useActionSheet && !selectionMode && (contextMenuItems?.length ?? 0) > 0;

  const handleSelectClick = (e: { shiftKey: boolean; preventDefault?: () => void }) => {
    e.preventDefault?.();
    onSelectItem?.(e.shiftKey);
  };

  const row: ReactElement = (
    <li
      ref={rowRef}
      style={rowStyle}
      role={selectionMode ? "option" : undefined}
      aria-selected={selectionMode ? selected : undefined}
      className={[
        "hover:bg-muted group flex min-h-11 items-center gap-1 rounded-lg px-1 py-1",
        canDrag ? "touch-pan-y cursor-grab active:cursor-grabbing select-none" : "",
        selectionMode ? "cursor-pointer select-none" : "",
        dragging ? "opacity-50" : "",
        selected ? "bg-primary/20 ring-primary/40 ring-1 ring-inset" : "",
        active && !selected ? "ring-primary/30 bg-primary/5 ring-1 ring-inset" : "",
      ].join(" ")}
      onContextMenu={useActionSheet && !selectionMode ? longPress.onContextMenu : undefined}
      onTouchStart={longPress.onTouchStart}
      onTouchEnd={longPress.onTouchEnd}
      onTouchMove={longPress.onTouchMove}
      onTouchCancel={longPress.onTouchEnd}
      onClick={
        selectionMode
          ? (e) => {
              handleSelectClick(e);
            }
          : undefined
      }
      {...(canDrag && dragAttributes ? dragAttributes : {})}
      {...(canDrag && dragListeners ? dragListeners : {})}
    >
      {selectionMode ? (
        <span
          className={[
            "mx-1 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            selected ? "border-primary bg-primary" : "border-muted-foreground/35 bg-transparent",
          ].join(" ")}
          aria-hidden
        >
          {selected ? <span className="bg-primary-foreground block size-2 rounded-full" /> : null}
        </span>
      ) : (
        <Checkbox
          checked={item.status === "completed"}
          {...(disabled !== undefined ? { disabled } : {})}
          onPointerDown={(e: ReactPointerEvent) => e.stopPropagation()}
          onCheckedChange={() => onToggleComplete()}
        />
      )}
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left text-sm"
        onClick={(e) => {
          if (selectionMode) {
            e.stopPropagation();
            handleSelectClick(e);
          } else onEdit();
        }}
      >
        {!selectionMode && secondaryLine == null ? (
          <span
            className={`size-2 shrink-0 rounded-full ${priorityDot(item.priority)}`}
            aria-hidden
          />
        ) : null}
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate ${item.status === "completed" ? "line-through opacity-60" : ""}`}
          >
            {item.title}
          </span>
          <TaskItemTagStrip
            titles={tagTitles}
            {...(item.status === "completed" ? { className: "opacity-60" } : {})}
          />
          {secondaryLine ? (
            <span className="text-muted-foreground block truncate text-xs">{secondaryLine}</span>
          ) : null}
        </span>
        {!selectionMode ? (
          <>
            {showEntityId ? (
              <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                #{item.id}
              </span>
            ) : null}
            {secondaryLine != null ? (
              <span className={`shrink-0 text-xs ${priorityDot(item.priority)}`} aria-hidden>
                ●
              </span>
            ) : null}
            {item.due_at ? (
              <span className="text-muted-foreground shrink-0 text-xs">
                {formatDue(item.due_at)}
              </span>
            ) : null}
          </>
        ) : null}
      </button>
      {useActionSheet && !selectionMode ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label="任务操作"
          {...(disabled !== undefined ? { disabled } : {})}
          onPointerDown={(e: ReactPointerEvent) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onOpenMenu();
          }}
        >
          ⋯
        </Button>
      ) : null}
    </li>
  );

  if (pointerMenu && contextMenuItems) {
    return <ContextMenu items={contextMenuItems}>{row}</ContextMenu>;
  }
  return row;
}
