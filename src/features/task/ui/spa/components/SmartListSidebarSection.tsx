import { Button } from "@freeanima/frontend/ui-kit";
import { useRef, type MouseEvent, type TouchEvent } from "react";

import type { SmartListRow } from "../lib/api.ts";
import { smartListRowKey } from "../lib/task-smart-list-utils.ts";

type BuiltinSmartListSectionProps = {
  smartLists: SmartListRow[];
  selectedKey: string | null;
  defaultInboxId: number | null;
  inboxItemCount: number;
  inboxSelected: boolean;
  onSelectSmartList: (row: SmartListRow) => void;
  onSelectInbox: () => void;
};

type CustomSmartListSectionProps = {
  smartLists: SmartListRow[];
  selectedKey: string | null;
  inboxSelected: boolean;
  onSelectSmartList: (row: SmartListRow) => void;
  onCreateSmartList: () => void;
  onOpenSmartListContextMenu: (e: MouseEvent, row: SmartListRow) => void;
  onOpenSmartListMenu: (row: SmartListRow) => void;
  useActionSheet: boolean;
};

function BuiltinSmartListRow({
  row,
  selected,
  onSelect,
}: {
  row: SmartListRow;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`hover:bg-muted flex w-full min-w-0 items-center rounded-md px-2 py-1.5 text-left text-sm ${
        selected ? "bg-muted font-medium" : ""
      }`}
      onClick={onSelect}
    >
      <span className="truncate">{row.title}</span>
    </button>
  );
}

function CustomSmartListRow({
  row,
  selected,
  onSelect,
  onContextMenu,
  onOpenMenu,
  useActionSheet,
}: {
  row: SmartListRow;
  selected: boolean;
  onSelect: () => void;
  onContextMenu: (e: MouseEvent) => void;
  onOpenMenu: () => void;
  useActionSheet: boolean;
}) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLongPress = () => {
    if (longPressTimer.current != null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchStart = (_e: TouchEvent) => {
    if (!useActionSheet) return;
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      onOpenMenu();
    }, 450);
  };

  return (
    <button
      type="button"
      className={`hover:bg-muted flex w-full min-w-0 items-center rounded-md px-2 py-1.5 text-left text-sm ${
        selected ? "bg-muted font-medium" : ""
      }`}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={clearLongPress}
      onTouchMove={clearLongPress}
      onTouchCancel={clearLongPress}
    >
      <span className="truncate">{row.title}</span>
    </button>
  );
}

export function BuiltinSmartListSection({
  smartLists,
  selectedKey,
  defaultInboxId,
  inboxItemCount,
  inboxSelected,
  onSelectSmartList,
  onSelectInbox,
}: BuiltinSmartListSectionProps) {
  const builtinRows = smartLists.filter((row) => row.preset != null);

  return (
    <div className="space-y-1 px-2 pt-2 pb-2">
      <div className="text-muted-foreground px-1 text-xs font-medium">智能清单</div>
      {builtinRows.map((row) => (
        <BuiltinSmartListRow
          key={smartListRowKey(row)}
          row={row}
          selected={!inboxSelected && selectedKey === smartListRowKey(row)}
          onSelect={() => onSelectSmartList(row)}
        />
      ))}
      {defaultInboxId != null ? (
        <button
          type="button"
          className={`hover:bg-muted flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm ${
            inboxSelected ? "bg-muted font-medium" : ""
          }`}
          onClick={onSelectInbox}
        >
          <span className="min-w-0 flex-1 truncate">收件箱</span>
          <span className="text-muted-foreground shrink-0 text-xs">{inboxItemCount}</span>
        </button>
      ) : null}
    </div>
  );
}

export function CustomSmartListSection({
  smartLists,
  selectedKey,
  inboxSelected,
  onSelectSmartList,
  onCreateSmartList,
  onOpenSmartListContextMenu,
  onOpenSmartListMenu,
  useActionSheet,
}: CustomSmartListSectionProps) {
  const customRows = smartLists.filter((row) => row.id != null);

  return (
    <div className="space-y-1 border-t px-2 pt-2 pb-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="text-muted-foreground text-xs font-medium">自定义智能清单</div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          aria-label="新建自定义智能清单"
          onClick={onCreateSmartList}
        >
          +
        </Button>
      </div>
      {customRows.length === 0 ? (
        <p className="text-muted-foreground px-1 py-1 text-xs">暂无自定义智能清单</p>
      ) : (
        customRows.map((row) => (
          <CustomSmartListRow
            key={smartListRowKey(row)}
            row={row}
            selected={!inboxSelected && selectedKey === smartListRowKey(row)}
            onSelect={() => onSelectSmartList(row)}
            onContextMenu={(e) => onOpenSmartListContextMenu(e, row)}
            onOpenMenu={() => onOpenSmartListMenu(row)}
            useActionSheet={useActionSheet}
          />
        ))
      )}
    </div>
  );
}
