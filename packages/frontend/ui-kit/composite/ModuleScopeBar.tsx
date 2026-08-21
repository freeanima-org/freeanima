import type { ReactNode } from "react";

type ModuleScopeBarProps = {
  children?: ReactNode;
};

/** 模块侧栏顶条（曾放 User/Agent 切换；现可空） */
export function ModuleScopeBar({ children }: ModuleScopeBarProps) {
  if (children == null || children === false) return null;
  return <div className="shrink-0 border-b border-border p-2">{children}</div>;
}
