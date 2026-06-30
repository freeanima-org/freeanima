import type { ConfirmDialogVariant, StatusAlertVariant } from "./types.ts";

export function confirmButtonClass(variant: ConfirmDialogVariant): string {
  return variant === "error" ? "btn btn-error btn-sm" : "btn btn-primary btn-sm";
}

export function statusAlertClass(variant: StatusAlertVariant): string {
  return `alert alert-${variant} text-sm`;
}
