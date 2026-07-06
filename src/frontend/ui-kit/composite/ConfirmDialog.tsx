import type { ReactNode } from "react";

import { Button } from "../components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog.tsx";
import { cn } from "../lib/cn.ts";
import { m } from "./i18n.ts";
import type { ConfirmDialogVariant } from "./types.ts";
import { confirmButtonVariant } from "./variants.ts";

export type ConfirmDialogProps = {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  variant?: ConfirmDialogVariant;
  /** 为 false 时仅显示确认按钮（用于 alert 式提示） */
  cancelable?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = "primary",
  cancelable = true,
  onConfirm,
  onCancel,
  className,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent
        className={cn("max-w-sm safe-area-pt safe-area-pb", className)}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description != null && description !== "" ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <DialogFooter>
          {cancelable ? (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              {cancelLabel ?? m.ui_common_cancel()}
            </Button>
          ) : null}
          <Button
            type="button"
            variant={confirmButtonVariant(variant)}
            size="sm"
            onClick={onConfirm}
          >
            {confirmLabel ?? m.ui_common_confirm()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
