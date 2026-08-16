import type { CSSProperties, PointerEvent as ReactPointerEvent, Ref } from "react";

import { Checkbox } from "../components/ui/checkbox.tsx";
import { formatDue } from "../lib/datetime-local.ts";
import {
  PRIORITY_LABEL,
  priorityToneBg,
  resolveTaskTagTitles,
  type TaskItemDisplay,
} from "../lib/task-item-display.ts";
import { ListRow } from "./ListRow.tsx";
import { TaskItemTagStrip } from "./TaskItemTagStrip.tsx";
import type { ActionSheetItem } from "./types.ts";

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
  const tagTitles = resolveTaskTagTitles(item.tag_ids, tagTitleById);

  const handleSelectClick = (e: { shiftKey: boolean; preventDefault?: () => void }) => {
    e.preventDefault?.();
    onSelectItem?.(e.shiftKey);
  };

  const leading = selectionMode ? (
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
      isSelected={item.status === "completed"}
      {...(disabled !== undefined ? { isDisabled: disabled } : {})}
      onPointerDown={(e: ReactPointerEvent) => e.stopPropagation()}
      onChange={() => onToggleComplete()}
    />
  );

  return (
    <ListRow
      as="li"
      active={active}
      selected={selected}
      disabled={disabled}
      selectionMode={selectionMode}
      dragging={dragging}
      useActionSheet={useActionSheet}
      contextMenuItems={contextMenuItems}
      contextMenuEnabled={contextMenuEnabled}
      longPressEnabled={longPressEnabled}
      onLongPress={onLongPress}
      onOpenMenu={onOpenMenu}
      menuAriaLabel="任务操作"
      dragAttributes={dragAttributes}
      dragListeners={dragListeners}
      rowRef={rowRef}
      rowStyle={rowStyle}
      onClick={
        selectionMode
          ? (e) => {
              handleSelectClick(e);
            }
          : undefined
      }
      leading={leading}
    >
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
        {!selectionMode ? (
          <span
            className={`size-2 shrink-0 rounded-full ${priorityToneBg(item.priority)}`}
            title={PRIORITY_LABEL[item.priority]}
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
            {item.due_at ? (
              <span className="text-muted-foreground shrink-0 text-xs">
                {formatDue(item.due_at)}
              </span>
            ) : null}
          </>
        ) : null}
      </button>
    </ListRow>
  );
}
