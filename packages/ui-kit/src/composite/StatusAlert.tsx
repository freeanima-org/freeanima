import type { ReactNode } from "react";

import { cn } from "../lib/cn.ts";
import type { StatusAlertVariant } from "./types.ts";
import { statusAlertClass } from "./variants.ts";

export type StatusAlertProps = {
  variant: StatusAlertVariant;
  children: ReactNode;
  className?: string;
};

export function StatusAlert({ variant, children, className }: StatusAlertProps) {
  return <div className={cn(statusAlertClass(variant), className)}>{children}</div>;
}
