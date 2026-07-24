import type { ReactNode } from "react";

import { Alert } from "../components/ui/alert.tsx";
import { cn } from "../lib/cn.ts";
import type { StatusAlertVariant } from "./types.ts";
import { statusAlertVariant } from "./variants.ts";

export type StatusAlertProps = {
  variant: StatusAlertVariant;
  children: ReactNode;
  className?: string;
};

export function StatusAlert({ variant, children, className }: StatusAlertProps) {
  return (
    <Alert variant={statusAlertVariant(variant)} className={cn("text-sm", className)}>
      {children}
    </Alert>
  );
}
