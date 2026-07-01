import { type ReactNode } from "react";
import { Button, Sheet, SheetContent, SheetHeader, SheetTitle } from "@freeanima/ui-kit";

import type { TaskLayoutMode } from "../lib/layout-mode.ts";

type TaskThreeColumnLayoutProps = {
  layoutMode: TaskLayoutMode;
  listTitle?: string;
  taskListTitle: ReactNode;
  detailTitle: ReactNode;
  list: ReactNode;
  taskList: ReactNode;
  detail: ReactNode;
  detailOpen: boolean;
  onDetailOpenChange: (open: boolean) => void;
  listOpen: boolean;
  onListOpenChange: (open: boolean) => void;
  listToggleAriaLabel?: string;
  taskListActions?: ReactNode;
  taskListHeaderExtra?: ReactNode;
};

const listAsideClass =
  "relative flex min-h-0 w-56 shrink-0 flex-col border-r border-border bg-background";
const listDrawerClass =
  "list-detail-drawer-panel safe-fixed-sidebar flex min-h-0 flex-col border-r border-border bg-background shadow-lg";
const taskListWideClass =
  "relative flex min-h-0 w-80 shrink-0 flex-col border-r border-border bg-background";
const taskListFlexClass = "relative flex min-h-0 min-w-0 flex-1 flex-col bg-background";
const detailWideClass = "relative flex min-h-0 min-w-0 flex-1 flex-col border-border bg-background";

export function TaskThreeColumnLayout({
  layoutMode,
  listTitle = "清单",
  taskListTitle,
  detailTitle,
  list,
  taskList,
  detail,
  detailOpen,
  onDetailOpenChange,
  listOpen,
  onListOpenChange,
  listToggleAriaLabel = "打开清单",
  taskListActions,
  taskListHeaderExtra,
}: TaskThreeColumnLayoutProps) {
  const isCompact = layoutMode === "compact";
  const isWide = layoutMode === "wide";

  const taskListHeader = (
    <header className="border flex shrink-0 flex-col gap-2 border-b px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        {isCompact ? (
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
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{taskListTitle}</h1>
        {taskListActions ? (
          <div className="flex shrink-0 items-center gap-2">{taskListActions}</div>
        ) : null}
      </div>
      {taskListHeaderExtra}
    </header>
  );

  const listHeader = !isCompact ? (
    <div className="border shrink-0 border-b p-3 text-sm font-semibold">{listTitle}</div>
  ) : null;

  const listPanel = (
    <>
      {listHeader}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{list}</div>
    </>
  );

  const taskListPanel = (
    <>
      {taskListHeader}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{taskList}</div>
    </>
  );

  const detailHeader = (
    <header className="border flex shrink-0 items-center border-b px-4 py-3">
      <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{detailTitle}</h2>
    </header>
  );

  const detailPanel = (
    <>
      {detailHeader}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{detail}</div>
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative flex min-h-0 flex-1">
        {isCompact && listOpen ? (
          <div
            className="list-detail-drawer-overlay bg-black/55"
            onClick={() => onListOpenChange(false)}
            aria-hidden
          />
        ) : null}

        {!isCompact ? <aside className={listAsideClass}>{listPanel}</aside> : null}

        {isCompact ? (
          <aside className={listOpen ? listDrawerClass : "hidden"}>{listPanel}</aside>
        ) : null}

        <section className={isWide ? taskListWideClass : taskListFlexClass}>
          {taskListPanel}
        </section>

        {isWide ? <aside className={detailWideClass}>{detailPanel}</aside> : null}
      </div>

      {!isWide ? (
        <Sheet open={detailOpen} onOpenChange={onDetailOpenChange}>
          <SheetContent
            side={isCompact ? "bottom" : "right"}
            className={
              isCompact
                ? "flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-full"
                : "flex w-[min(85vw,28rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
            }
          >
            <SheetHeader className="border shrink-0 border-b px-4 py-3">
              <SheetTitle className="truncate">{detailTitle}</SheetTitle>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{detail}</div>
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}
