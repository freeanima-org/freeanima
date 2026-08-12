import type { ReactNode } from "react";

import { Dialog } from "../components/ui/dialog.tsx";
import { Sheet } from "../components/ui/sheet.tsx";
import { useCompactLayout } from "../layout/index.ts";
import { cn } from "../lib/cn.ts";

export type ModalSheetPresentProps = {
  open: boolean;
  onClose: () => void;
  /** 无障碍标题（传给 Dialog/Sheet） */
  "aria-label"?: string;
  /** 右上角关闭钮；默认 false（调用方自带关闭时用） */
  showCloseButton?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * ModalSheetPresent：expanded → Dialog，compact → bottom Sheet。
 * 禁止自研 createPortal + fixed 遮罩。
 */
export function ModalSheetPresent({
  open,
  onClose,
  "aria-label": ariaLabel,
  showCloseButton = false,
  className,
  children,
}: ModalSheetPresentProps) {
  const compact = useCompactLayout();
  const onOpenChange = (next: boolean) => {
    if (!next) onClose();
  };

  if (compact) {
    return (
      <Sheet
        isOpen={open}
        onOpenChange={onOpenChange}
        side="bottom"
        showCloseButton={showCloseButton}
        {...(ariaLabel !== undefined ? { "aria-label": ariaLabel } : {})}
        className={cn(
          "max-h-[85vh] gap-0 overflow-hidden rounded-t-2xl p-0 safe-area-pb",
          className,
        )}
      >
        {children}
      </Sheet>
    );
  }

  return (
    <Dialog
      isOpen={open}
      onOpenChange={onOpenChange}
      showCloseButton={showCloseButton}
      {...(ariaLabel !== undefined ? { "aria-label": ariaLabel } : {})}
      className={cn(
        "max-h-[min(85vh,48rem)] w-full max-w-xl gap-0 overflow-hidden p-0 sm:max-w-xl",
        className,
      )}
    >
      {children}
    </Dialog>
  );
}
