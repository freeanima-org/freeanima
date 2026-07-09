import type { ReactNode } from "react";

import { Button } from "../components/ui/button.tsx";

export type DetailSaveStatus = "idle" | "saving" | "saved" | "error";

function saveStatusLabel(status: DetailSaveStatus): string {
  switch (status) {
    case "saving":
      return "保存中…";
    case "saved":
      return "已保存";
    case "error":
      return "保存失败";
    default:
      return "";
  }
}

export type DetailPanelShellProps = {
  onClose: () => void;
  closeLabel?: string;
  saveStatus?: DetailSaveStatus;
  children: ReactNode;
};

export function DetailPanelShell({
  onClose,
  closeLabel = "关闭",
  saveStatus = "idle",
  children,
}: DetailPanelShellProps) {
  const statusLabel = saveStatusLabel(saveStatus);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      <div className="border safe-area-pb flex shrink-0 items-center gap-2 border-t p-4">
        <Button type="button" variant="ghost" className="min-w-24 flex-1" onClick={onClose}>
          {closeLabel}
        </Button>
        {statusLabel ? (
          <span className="text-muted-foreground min-w-0 flex-1 text-right text-xs">
            {statusLabel}
          </span>
        ) : (
          <span className="flex-1" aria-hidden />
        )}
      </div>
    </div>
  );
}
