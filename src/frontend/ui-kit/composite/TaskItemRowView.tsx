import type { CSSProperties, MouseEvent, ReactNode, Ref } from "react";

import { Button } from "../components/ui/button.tsx";
import { Checkbox } from "../components/ui/checkbox.tsx";
import { formatDue } from "../lib/datetime-local.ts";
import { priorityDot, type TaskItemDisplay } from "../lib/task-item-display.ts";
import { useLongPress } from "./useLongPress.ts";

export type TaskItemRowViewProps = {
  item: TaskItemDisplay;
  active?: boolean;
  selected?: boolean;
  disabled?: boolean;
  selectionMode?: boolean;
  useActionSheet: boolean;
  secondaryLine?: string | null;
  showEntityId?: boolean;
  dragHandle?: ReactNode;
  rowRef?: Ref<HTMLLIElement>;
  rowStyle?: CSSProperties;
  dragging?: boolean;
  longPressEnabled?: boolean;
  onToggleComplete: () => void;
  onEdit: () => void;
  onOpenMenu: () => void;
  onContextMenu: (e: MouseEvent) => void;
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
  secondaryLine,
  showEntityId = false,
  dragHandle,
  rowRef,
  rowStyle,
  dragging = false,
  longPressEnabled = false,
  onToggleComplete,
  onEdit,
  onOpenMenu,
  onContextMenu,
  onSelectItem,
  onLongPress,
}: TaskItemRowViewProps) {
  const longPress = useLongPress({
    enabled: longPressEnabled && useActionSheet && !selectionMode,
    onTrigger: () => onLongPress?.(),
  });

  const handleContextMenu = (e: MouseEvent) => {
    if (longPressEnabled && useActionSheet && !selectionMode) {
      longPress.onContextMenu(e);
      return;
    }
    onContextMenu(e);
  };

  return (
    <li
      ref={rowRef}
      style={rowStyle}
      className={[
        "hover:bg-muted group flex min-h-11 items-center gap-1 rounded-lg px-1 py-1",
        dragging ? "opacity-50" : "",
        selected ? "bg-primary/10" : "",
        active && !selected ? "ring-primary/30 bg-primary/5 ring-1 ring-inset" : "",
      ].join(" ")}
      onContextMenu={handleContextMenu}
      onTouchStart={longPress.onTouchStart}
      onTouchEnd={longPress.onTouchEnd}
      onTouchMove={longPress.onTouchMove}
      onTouchCancel={longPress.onTouchEnd}
    >
      {dragHandle}
      <Checkbox
        checked={selectionMode ? selected : item.status === "completed"}
        disabled={disabled}
        onClick={(e) => {
          if (selectionMode) {
            e.preventDefault();
            onSelectItem?.(e.shiftKey);
          }
        }}
        {...(selectionMode ? {} : { onCheckedChange: () => onToggleComplete() })}
      />
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left text-sm"
        onClick={(e) => {
          if (selectionMode) onSelectItem?.(e.shiftKey);
          else onEdit();
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
          disabled={disabled}
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
}
