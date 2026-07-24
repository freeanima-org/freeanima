import type { ReactNode } from "react";

export type DetailSaveStatus = "idle" | "saving" | "saved" | "error";

export type DetailPanelShellProps = {
  /** @deprecated 底栏已移除；保留参数以免破坏调用方 */
  onClose?: () => void;
  closeLabel?: string;
  saveStatus?: DetailSaveStatus;
  children: ReactNode;
};

/** 详情内容壳：撑满高度，无底栏取消行 */
export function DetailPanelShell({ children }: DetailPanelShellProps) {
  return <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>;
}
