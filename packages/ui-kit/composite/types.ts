export type ConfirmDialogVariant = "primary" | "error";

export type StatusAlertVariant = "info" | "success" | "warning" | "error";

export type ActionSheetItem = {
  label: string;
  danger?: boolean;
  onClick: () => void;
};
