import { useCallback, useState, type ReactNode } from "react";

import { Button } from "../components/ui/button.tsx";
import { useDrawerNav } from "./viewport.ts";

export type ListDetailListContext = {
  close: () => void;
  open: () => void;
  isDrawer: boolean;
};

export type ListDetailLayoutProps = {
  detailTitle: ReactNode;
  listTitle?: string;
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
};

export function ListDetailLayout({
  detailTitle,
  listTitle,
  listSubtitle,
  showListHeader = true,
  listHeaderClassName = "border shrink-0 border-b p-3 text-sm font-semibold",
  listWidthClass = "w-56",
  listAsideClassName = "border bg-muted/95 backdrop-blur-sm",
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
}: ListDetailLayoutProps) {
  const useDrawer = useDrawerNav();
  const [listOpenInternal, setListOpenInternal] = useState(false);
  const listOpen = listOpenControlled ?? listOpenInternal;

  const drawerAsideClass = "list-detail-drawer-panel safe-fixed-sidebar";
  const desktopAsideClass = [
    "relative flex min-h-0 shrink-0 flex-col border-r",
    listWidthClass,
    listAsideClassName,
  ].join(" ");

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

      <div className="relative flex min-h-0 flex-1">
        {listOpen && useDrawer ? (
          <div className="list-detail-drawer-overlay" onClick={closeList} aria-hidden />
        ) : null}

        <aside className={useDrawer ? (listOpen ? drawerAsideClass : "hidden") : desktopAsideClass}>
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
          <div className="flex min-h-0 flex-1 flex-col">{list(listCtx)}</div>
        </aside>

        <main className={`flex min-h-0 min-w-0 flex-1 flex-col ${detailClassName}`.trim()}>
          {!useDrawer ? detailHeaderBlock : null}
          {children}
        </main>
      </div>
    </div>
  );
}
