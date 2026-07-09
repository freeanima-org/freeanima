import type { ReactNode } from "react";

type ModuleScopeBarProps = {
  children: ReactNode;
};

/** 模块侧栏顶部的 User/Agent 切换条 */
export function ModuleScopeBar({ children }: ModuleScopeBarProps) {
  return <div className="shrink-0 border-b border-border p-2">{children}</div>;
}
