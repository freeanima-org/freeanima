import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { Button } from "../components/ui/button.tsx";
import { ColumnResizeHandle } from "./ColumnResizeHandle.tsx";
import { useObservedWidth } from "./observed-width.ts";
import { clampListWidthForContainer } from "./three-column-container-mode.ts";
import {
  DEFAULT_COLUMN_SPLIT_LIMITS,
  resolveColumnSplits,
  writeColumnSplits,
} from "./column-split.ts";
import { useDrawerNav } from "./viewport.ts";

export type ListDetailListContext = {
  close: () => void;
  open: () => void;
  isDrawer: boolean;
};

export type ListDetailLayoutProps = {
  detailTitle: ReactNode;
  listTitle?: ReactNode;
  listSubtitle?: string;
  showListHeader?: boolean;
  listHeaderClassName?: string;
  listWidthClass?: string;
  listAsideClassName?: string;
  list: (ctx: ListDetailListContext) => ReactNode;
  children: ReactNode;
  detailActions?: ReactNode;
  detailHeaderExtra?: ReactNode;
  listOpen?: boolean;
  onListOpenChange?: (open: boolean) => void;
  listToggleAriaLabel?: string;
  showDetailHeader?: boolean;
  detailHeaderPlacement?: "auto" | "none";
  detailClassName?: string;
  className?: string;
  columnSplitKey?: string;
  defaultListWidthPx?: number;
};

const LIST_DEFAULT_PX = 224;

function listColumnStyle(width: number): CSSProperties {
  return {
    width,
    flex: "0 0 auto",
    minWidth: width,
    maxWidth: width,
  };
}

export function ListDetailLayout({
  detailTitle,
  listTitle,
  listSubtitle,
  showListHeader = true,
  listHeaderClassName = "border shrink-0 border-b p-3 text-sm font-semibold",
  listWidthClass = "w-56",
  listAsideClassName = "border bg-background",
  list,
  children,
  detailActions,
  detailHeaderExtra,
  listOpen: listOpenControlled,
  onListOpenChange,
  listToggleAriaLabel = "打开列表",
  showDetailHeader = true,
  detailHeaderPlacement = "auto",
  detailClassName = "",
  className = "",
  columnSplitKey,
  defaultListWidthPx = LIST_DEFAULT_PX,
}: ListDetailLayoutProps) {
  const useDrawer = useDrawerNav();
  const [listOpenInternal, setListOpenInternal] = useState(false);
  const listOpen = listOpenControlled ?? listOpenInternal;
  const resizeEnabled = Boolean(columnSplitKey) && !useDrawer;

  const [rowRef, containerWidth] = useObservedWidth();

  const [listWidth, setListWidth] = useState(() =>
    resizeEnabled
      ? (resolveColumnSplits(columnSplitKey ?? "list-detail", { list: defaultListWidthPx }).list ??
        defaultListWidthPx)
      : defaultListWidthPx,
  );
  const listWidthRef = useRef(listWidth);
  listWidthRef.current = listWidth;

  const resizeList = useCallback(
    (delta: number) => {
      if (!resizeEnabled || !columnSplitKey) return;
      const limits = DEFAULT_COLUMN_SPLIT_LIMITS.list;
      const next = clampListWidthForContainer(
        listWidthRef.current + delta,
        0,
        containerWidth,
        limits,
      );
      listWidthRef.current = next;
      setListWidth(next);
      writeColumnSplits(columnSplitKey, { list: next });
    },
    [resizeEnabled, columnSplitKey, containerWidth],
  );

  const drawerAsideClass =
    "list-detail-drawer-panel safe-fixed-sidebar border-r border-border bg-background shadow-lg";
  const desktopAsideClass = [
    "relative flex min-h-0 min-w-0 shrink-0 flex-col overflow-hidden border-r",
    resizeEnabled ? "" : listWidthClass,
    listAsideClassName,
  ]
    .filter(Boolean)
    .join(" ");

  const setListOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const value = typeof next === "function" ? next(listOpen) : next;
      if (listOpenControlled === undefined) {
        setListOpenInternal(value);
      }
      onListOpenChange?.(value);
    },
    [listOpen, listOpenControlled, onListOpenChange],
  );

  const closeList = useCallback(() => setListOpen(false), [setListOpen]);
  const openList = useCallback(() => setListOpen(true), [setListOpen]);

  const listCtx: ListDetailListContext = {
    close: closeList,
    open: openList,
    isDrawer: useDrawer,
  };

  const renderLayoutHeader = detailHeaderPlacement === "auto";

  const detailHeaderBlock =
    renderLayoutHeader && showDetailHeader ? (
      <header className="border flex shrink-0 flex-col gap-2 border-b px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="min-w-0 truncate text-lg font-semibold">{detailTitle}</h1>
          {detailActions ? (
            <div className="flex shrink-0 items-center gap-2">{detailActions}</div>
          ) : null}
        </div>
        {detailHeaderExtra}
      </header>
    ) : null;

  const drawerHeaderBlock =
    renderLayoutHeader && useDrawer ? (
      <header className="border bg-muted flex shrink-0 flex-col gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-expanded={listOpen}
            aria-label={listToggleAriaLabel}
            onClick={() => setListOpen((v) => !v)}
          >
            ☰
          </Button>
          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{detailTitle}</h1>
          {detailActions ? (
            <div className="flex shrink-0 items-center gap-2">{detailActions}</div>
          ) : null}
        </div>
        {detailHeaderExtra}
      </header>
    ) : null;

  return (
    <div className={`flex h-full min-h-0 flex-col ${className}`.trim()}>
      {drawerHeaderBlock}

      <div ref={rowRef} className="relative flex min-h-0 flex-1">
        {listOpen && useDrawer ? (
          <div className="list-detail-drawer-overlay bg-black/55" onClick={closeList} aria-hidden />
        ) : null}

        <aside
          className={useDrawer ? (listOpen ? drawerAsideClass : "hidden") : desktopAsideClass}
          style={useDrawer ? undefined : resizeEnabled ? listColumnStyle(listWidth) : undefined}
        >
          {showListHeader && listTitle && !useDrawer ? (
            <div className={listHeaderClassName}>
              {listTitle}
              {listSubtitle ? (
                <span className="text-muted-foreground mt-0.5 block text-xs font-normal">
                  {listSubtitle}
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {list(listCtx)}
          </div>
        </aside>

        {resizeEnabled ? <ColumnResizeHandle onResize={resizeList} /> : null}

        <main className={`flex min-h-0 min-w-0 flex-1 flex-col ${detailClassName}`.trim()}>
          {!useDrawer ? detailHeaderBlock : null}
          {children}
        </main>
      </div>
    </div>
  );
}
