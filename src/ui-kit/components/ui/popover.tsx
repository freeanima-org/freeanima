import * as React from "react";
import {
  Dialog as DialogPrimitive,
  DialogTrigger as DialogTriggerPrimitive,
  Popover as PopoverPrimitive,
  type DialogTriggerProps as DialogTriggerPrimitiveProps,
} from "react-aria-components";

import { cn } from "../../lib/utils.ts";

/** 非 Menu 弹层触发器（可承载表单；与 DropdownMenu 区分） */
function PopoverTrigger({ ...props }: DialogTriggerPrimitiveProps) {
  return <DialogTriggerPrimitive data-slot="popover-trigger" {...props} />;
}

function Popover({
  "data-slot": dataSlot = "popover-content",
  placement = "bottom start",
  offset = 4,
  crossOffset = 0,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof PopoverPrimitive>, "children" | "className"> & {
  "data-slot"?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <PopoverPrimitive
      data-slot={dataSlot}
      placement={placement}
      offset={offset}
      crossOffset={crossOffset}
      className={cn(
        "cn-menu-translucent z-50 origin-(--trigger-anchor-point) rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-entering:animate-in data-entering:fade-in-0 data-entering:zoom-in-95 data-exiting:animate-out data-exiting:fade-out-0 data-exiting:zoom-out-95 data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    >
      {children}
    </PopoverPrimitive>
  );
}

/** Popover 内焦点容器（非 Modal Dialog） */
function PopoverDialog({ className, ...props }: React.ComponentProps<typeof DialogPrimitive>) {
  return (
    <DialogPrimitive
      data-slot="popover-dialog"
      className={cn("outline-none", className)}
      {...props}
    />
  );
}

export { Popover, PopoverDialog, PopoverTrigger };
