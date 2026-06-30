import type { ReactNode } from "react";

import { cn } from "../lib/cn.ts";

export type EmptyStateProps = {
  message: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ message, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "text-sm text-base-content/60 py-4 text-center flex flex-col items-center gap-2",
        className,
      )}
    >
      {icon}
      <div>{message}</div>
      {action}
    </div>
  );
}
