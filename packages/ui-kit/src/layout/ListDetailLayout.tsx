import { useCallback, useState, type ReactNode } from "react";

import { useDrawerNav } from "./viewport.ts";

export type ListDetailListContext = {
  close: () => void;
  open: () => void;
  isDrawer: boolean;
};

export type ListDetailLayoutProps = {
  /** 详情区标题（drawer 顶栏与宽屏 detail header 共用） */
  detailTitle: ReactNode;
  /** 宽屏 list 栏顶栏标题 */
  listTitle?: string;
  listSubtitle?: string;
  showListHeader?: boolean;
  listHeaderClassName?: string;
  listWidthClass?: string;
  listAsideClassName?: string;
  /** list 栏内容 */
  list: (ctx: ListDetailListContext) => ReactNode;
  /** 详情区主体 */
  children: ReactNode;
  /** 详情顶栏右侧操作 */
  detailActions?: ReactNode;
  /** 顶栏下方扩展（如搜索框） */
  detailHeaderExtra?: ReactNode;
  /** 受控 drawer 开关（如 Task 拖拽时 open） */
  listOpen?: boolean;
  onListOpenChange?: (open: boolean) => void;
  listToggleAriaLabel?: string;
  /** 宽屏时在 main 内渲染 detail header；默认 true */
  showDetailHeader?: boolean;
  /** auto：layout 渲染顶栏；none：由父级自行渲染（如 Chat） */
  detailHeaderPlacement?: "auto" | "none";
  detailClassName?: string;
  className?: string;
};

export function ListDetailLayout({
  detailTitle,
  listTitle,
  listSubtitle,
  showListHeader = true,
  listHeaderClassName = "border-base-300 shrink-0 border-b p-3 text-sm font-semibold",
  listWidthClass = "w-56",
  listAsideClassName = "border-base-300 bg-base-200/95 backdrop-blur-sm",
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

  /** drawer 模式：不透明侧栏；listAsideClassName 仅作用于宽屏常驻栏 */
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
      <header className="border-base-300 flex shrink-0 flex-col gap-2 border-b px-4 py-3">
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
      <header className="border-base-300 bg-base-200 flex shrink-0 flex-col gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square"
            aria-expanded={listOpen}
            aria-label={listToggleAriaLabel}
            onClick={() => setListOpen((v) => !v)}
          >
            ☰
          </button>
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
                <span className="text-base-content/60 mt-0.5 block text-xs font-normal">
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
