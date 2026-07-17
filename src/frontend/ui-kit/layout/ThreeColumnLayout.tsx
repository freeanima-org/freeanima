import { type CSSProperties, type ReactNode } from "react";

import { Button } from "../components/ui/button.tsx";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../components/ui/sheet.tsx";
import { ColumnResizeHandle } from "./ColumnResizeHandle.tsx";
import { useObservedWidth } from "./observed-width.ts";
import type { ThreeColumnLayoutMode } from "./three-column-mode.ts";
import { resolveThreeColumnMode } from "./three-column-container-mode.ts";
import { useColumnResizeDrag } from "./useColumnResizeDrag.ts";

export type ThreeColumnLayoutProps = {
  layoutMode: ThreeColumnLayoutMode;
  listTitle?: string;
  middleTitle: ReactNode;
  /** 省略或空字符串时不渲染详情栏顶栏标题（Sheet 仍保留 sr-only 标题） */
  detailTitle?: ReactNode;
  list: ReactNode;
  middle: ReactNode;
  detail: ReactNode;
  detailOpen: boolean;
  onDetailOpenChange: (open: boolean) => void;
  listOpen: boolean;
  onListOpenChange: (open: boolean) => void;
  listToggleAriaLabel?: string;
  middleActions?: ReactNode;
  middleHeaderExtra?: ReactNode;
  /** 设置后在中/宽屏启用列宽拖拽，宽度持久化到 localStorage */
  columnSplitKey?: string;
};

function hasVisibleDetailTitle(title: ReactNode | undefined): boolean {
  if (title == null || title === false) return false;
  if (typeof title === "string") return title.trim() !== "";
  return true;
}

const LIST_DEFAULT_PX = 256;
const MIDDLE_DEFAULT_PX = 320;

const listDrawerClass =
  "list-detail-drawer-panel safe-fixed-sidebar flex min-h-0 flex-col border-r border-border bg-background shadow-lg";
const detailPanelClass =
  "relative flex min-h-0 min-w-0 flex-1 flex-col border-border bg-background";

function columnStyle(width: number | undefined): CSSProperties | undefined {
  if (width == null) return undefined;
  return {
    width,
    flex: "0 0 auto",
    minWidth: width,
    maxWidth: width,
  };
}

export function ThreeColumnLayout({
  layoutMode,
  listTitle = "列表",
  middleTitle,
  detailTitle,
  list,
  middle,
  detail,
  detailOpen,
  onDetailOpenChange,
  listOpen,
  onListOpenChange,
  listToggleAriaLabel = "打开侧栏",
  middleActions,
  middleHeaderExtra,
  columnSplitKey,
}: ThreeColumnLayoutProps) {
  const [rowRef, containerWidth] = useObservedWidth();

  const effectiveMode = resolveThreeColumnMode(containerWidth, layoutMode);

  const isCompact = effectiveMode === "compact";
  const isMedium = effectiveMode === "medium";
  const isWide = effectiveMode === "wide";
  const listInDrawer = isCompact || isMedium;
  const showDetailColumn = isMedium || isWide;
  const resizeEnabled = Boolean(columnSplitKey) && !isCompact;

  const { listWidth, middleWidth, resizeList, resizeMiddle } = useColumnResizeDrag({
    storageKey: columnSplitKey ?? "three-column",
    defaults: { list: LIST_DEFAULT_PX, middle: MIDDLE_DEFAULT_PX },
    enabled: resizeEnabled,
    containerWidth,
    listInRow: isWide,
  });

  const listAsideClass = [
    "relative flex min-h-0 shrink-0 flex-col border-r border-border bg-background",
    !resizeEnabled || !isWide ? "w-64" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const middleClass = [
    "relative flex min-h-0 flex-col border-r border-border bg-background min-w-0",
    !resizeEnabled && isWide ? "w-80 shrink-0" : "",
    !resizeEnabled && isMedium ? "min-w-0 flex-1" : "",
    resizeEnabled ? "shrink-0" : "",
    isCompact ? "min-w-0 flex-1" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const middleHeader = (
    <header className="border flex shrink-0 flex-col gap-2 border-b px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        {listInDrawer ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-expanded={listOpen}
            aria-label={listToggleAriaLabel}
            onClick={() => onListOpenChange(!listOpen)}
          >
            ☰
          </Button>
        ) : null}
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{middleTitle}</h1>
        {middleActions ? (
          <div className="flex shrink-0 items-center gap-2">{middleActions}</div>
        ) : null}
      </div>
      {middleHeaderExtra}
    </header>
  );

  const listHeader = isWide ? (
    <div className="border shrink-0 border-b p-3 text-sm font-semibold">{listTitle}</div>
  ) : null;

  const listPanel = (
    <>
      {listHeader}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{list}</div>
    </>
  );

  const middlePanel = (
    <>
      {middleHeader}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{middle}</div>
    </>
  );

  const showDetailHeader = hasVisibleDetailTitle(detailTitle);

  const detailPanel = (
    <>
      {showDetailHeader ? (
        <header className="border flex shrink-0 items-center border-b px-4 py-3">
          <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{detailTitle}</h2>
        </header>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col">{detail}</div>
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={rowRef} className="relative flex min-h-0 flex-1">
        {listInDrawer && listOpen ? (
          <div
            className="list-detail-drawer-overlay bg-black/55"
            onClick={() => onListOpenChange(false)}
            aria-hidden
          />
        ) : null}

        {isWide ? (
          <aside
            className={listAsideClass}
            style={resizeEnabled ? columnStyle(listWidth) : undefined}
          >
            {listPanel}
          </aside>
        ) : null}

        {resizeEnabled && isWide ? <ColumnResizeHandle onResize={resizeList} /> : null}

        {listInDrawer ? (
          <aside className={listOpen ? listDrawerClass : "hidden"}>{listPanel}</aside>
        ) : null}

        <section
          className={middleClass}
          style={resizeEnabled ? columnStyle(middleWidth) : undefined}
        >
          {middlePanel}
        </section>

        {resizeEnabled && showDetailColumn ? <ColumnResizeHandle onResize={resizeMiddle} /> : null}

        {showDetailColumn ? <aside className={detailPanelClass}>{detailPanel}</aside> : null}
      </div>

      {isCompact ? (
        <Sheet open={detailOpen} onOpenChange={onDetailOpenChange}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="flex h-[85dvh] max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-full"
          >
            <SheetHeader
              className={showDetailHeader ? "border shrink-0 border-b px-4 py-3" : "sr-only"}
            >
              <SheetTitle className="truncate">{detailTitle ?? "详情"}</SheetTitle>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{detail}</div>
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}
