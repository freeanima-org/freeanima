import type { ReactNode } from "react";

import { cn } from "../lib/cn.ts";
import { m } from "./i18n.ts";
import type { ConfirmDialogVariant } from "./types.ts";
import { confirmButtonClass } from "./variants.ts";

export type ConfirmDialogProps = {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  variant?: ConfirmDialogVariant;
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
  onConfirm,
  onCancel,
  className,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <dialog className={cn("modal modal-open safe-area-pt safe-area-pb", className)} open>
      <div className="modal-box max-w-sm">
        <h3 className="text-lg font-bold">{title}</h3>
        {description != null && description !== "" ? (
          <p className="text-sm text-base-content/70 py-2">{description}</p>
        ) : null}
        <div className="modal-action">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            {cancelLabel ?? m.ui_common_cancel()}
          </button>
          <button type="button" className={confirmButtonClass(variant)} onClick={onConfirm}>
            {confirmLabel ?? m.ui_common_confirm()}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onCancel}>
          close
        </button>
      </form>
    </dialog>
  );
}
