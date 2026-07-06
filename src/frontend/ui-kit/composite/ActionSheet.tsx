import type { ReactNode } from "react";

import { Button } from "../components/ui/button.tsx";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../components/ui/sheet.tsx";
import { cn } from "../lib/cn.ts";
import { m } from "./i18n.ts";
import type { ActionSheetItem } from "./types.ts";

export type ActionSheetProps = {
  title?: ReactNode;
  items: ActionSheetItem[];
  dismissLabel?: ReactNode;
  onClose: () => void;
  className?: string;
};

export function ActionSheet({ title, items, dismissLabel, onClose, className }: ActionSheetProps) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={cn("rounded-t-2xl p-0 sm:max-w-lg sm:mx-auto safe-area-pb", className)}
      >
        {title != null && title !== "" ? (
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="text-sm">{title}</SheetTitle>
          </SheetHeader>
        ) : null}
        <ul className="flex flex-col p-2">
          {items.map((item) => (
            <li key={item.label}>
              <button
                type="button"
                className={cn(
                  "flex w-full rounded-md px-4 py-3 text-left text-base hover:bg-accent",
                  item.danger && "text-destructive",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                  // 延后执行，避免同一次 click 被后续 Sheet/Dialog 判为「外部点击」而立刻关闭
                  queueMicrotask(item.onClick);
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t p-2">
          <Button type="button" variant="ghost" className="w-full" onClick={onClose}>
            {dismissLabel ?? m.ui_common_cancel()}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
