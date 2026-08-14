import type { ConfirmDialogVariant } from "./types.ts";

export function confirmButtonVariant(variant: ConfirmDialogVariant): "default" | "destructive" {
  return variant === "error" ? "destructive" : "default";
}

export function statusAlertVariant(
  variant: "info" | "success" | "warning" | "error",
): "info" | "success" | "warning" | "error" {
  return variant;
}
