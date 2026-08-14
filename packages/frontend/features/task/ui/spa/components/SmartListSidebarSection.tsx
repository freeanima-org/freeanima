import { Button } from "@freeanima/ui-kit";
import { EntityIdLabel, ListRow } from "@freeanima/ui-kit/composite";
import type { ActionSheetItem } from "@freeanima/ui-kit/composite";

import type { SmartListRow } from "../lib/api.ts";
import { smartListRowKey } from "../lib/task-smart-list-utils.ts";

const SIDEBAR_SELECTED = "bg-muted font-medium";

type BuiltinSmartListSectionProps = {
  smartLists: SmartListRow[];
  selectedKey: string | null;
  defaultInboxId: number | null;
  inboxItemCount: number;
  itemCounts: Map<string, number>;
  inboxSelected: boolean;
  onSelectSmartList: (row: SmartListRow) => void;
  onSelectInbox: () => void;
};

type CustomSmartListSectionProps = {
  smartLists: SmartListRow[];
  selectedKey: string | null;
  itemCounts: Map<string, number>;
  inboxSelected: boolean;
  onSelectSmartList: (row: SmartListRow) => void;
  onCreateSmartList: () => void;
  onOpenSmartListMenu: (row: SmartListRow) => void;
  contextMenuEnabled?: boolean;
  contextMenuItemsForSmartList?: ((row: SmartListRow) => ActionSheetItem[]) | undefined;
  useActionSheet: boolean;
};

function SidebarMeta({ id, count }: { id?: number | undefined; count?: number | undefined }) {
  if (id == null && count == null) return null;
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1.5 tabular-nums">
      {id != null ? <EntityIdLabel id={id} /> : null}
      {count != null ? <span className="text-muted-foreground text-xs">{count}</span> : null}
    </span>
  );
}

function BuiltinSmartListRow({
  row,
  selected,
  count,
  onSelect,
}: {
  row: SmartListRow;
  selected: boolean;
  count: number | undefined;
  onSelect: () => void;
}) {
  return (
    <ListRow
      as="div"
      selected={selected}
      selectedClassName={SIDEBAR_SELECTED}
      useActionSheet={false}
      showPersistentMenu={false}
      className="w-full gap-1 px-2 text-sm"
      onClick={onSelect}
    >
      <span className="min-w-0 flex-1 truncate text-left">{row.title}</span>
      <SidebarMeta count={count} />
    </ListRow>
  );
}

function CustomSmartListRow({
  row,
  selected,
  count,
  onSelect,
  onOpenMenu,
  useActionSheet,
  contextMenuEnabled,
  contextMenuItems,
}: {
  row: SmartListRow;
  selected: boolean;
  count: number | undefined;
  onSelect: () => void;
  onOpenMenu: () => void;
  useActionSheet: boolean;
  contextMenuEnabled: boolean;
  contextMenuItems?: ActionSheetItem[] | undefined;
}) {
  return (
    <ListRow
      as="div"
      selected={selected}
      selectedClassName={SIDEBAR_SELECTED}
      useActionSheet={useActionSheet}
      contextMenuEnabled={contextMenuEnabled}
      contextMenuItems={contextMenuItems}
      longPressEnabled={useActionSheet}
      onLongPress={onOpenMenu}
      onOpenMenu={onOpenMenu}
      className="w-full gap-1 px-2 text-sm"
      onClick={onSelect}
    >
      <span className="min-w-0 flex-1 truncate text-left">{row.title}</span>
      <SidebarMeta id={row.id} count={count} />
    </ListRow>
  );
}

export function BuiltinSmartListSection({
  smartLists,
  selectedKey,
  defaultInboxId,
  inboxItemCount,
  itemCounts,
  inboxSelected,
  onSelectSmartList,
  onSelectInbox,
}: BuiltinSmartListSectionProps) {
  const builtinRows = smartLists.filter((row) => row.preset != null);

  return (
    <div className="space-y-1 px-2 pt-2 pb-2">
      <div className="text-muted-foreground px-1 text-xs font-medium">智能清单</div>
      {builtinRows.map((row) => {
        const key = smartListRowKey(row);
        return (
          <BuiltinSmartListRow
            key={key}
            row={row}
            selected={!inboxSelected && selectedKey === key}
            count={itemCounts.get(key)}
            onSelect={() => onSelectSmartList(row)}
          />
        );
      })}
      {defaultInboxId != null ? (
        <ListRow
          as="div"
          selected={inboxSelected}
          selectedClassName={SIDEBAR_SELECTED}
          useActionSheet={false}
          showPersistentMenu={false}
          className="w-full gap-1 px-2 text-sm"
          onClick={onSelectInbox}
        >
          <span className="min-w-0 flex-1 truncate text-left">收件箱</span>
          <SidebarMeta id={defaultInboxId} count={inboxItemCount} />
        </ListRow>
      ) : null}
    </div>
  );
}

export function CustomSmartListSection({
  smartLists,
  selectedKey,
  itemCounts,
  inboxSelected,
  onSelectSmartList,
  onCreateSmartList,
  onOpenSmartListMenu,
  contextMenuEnabled = false,
  contextMenuItemsForSmartList,
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
        customRows.map((row) => {
          const key = smartListRowKey(row);
          return (
            <CustomSmartListRow
              key={key}
              row={row}
              selected={!inboxSelected && selectedKey === key}
              count={itemCounts.get(key)}
              onSelect={() => onSelectSmartList(row)}
              onOpenMenu={() => onOpenSmartListMenu(row)}
              useActionSheet={useActionSheet}
              contextMenuEnabled={contextMenuEnabled}
              contextMenuItems={contextMenuItemsForSmartList?.(row)}
            />
          );
        })
      )}
    </div>
  );
}
