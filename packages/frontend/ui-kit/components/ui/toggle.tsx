import type * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  ToggleButton as ToggleButtonPrimitive,
  type ToggleButtonProps as ToggleButtonPrimitiveProps,
} from "react-aria-components";

import { cn } from "../../lib/utils.ts";

const toggleVariants = cva(
  "group/toggle inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-transparent hover:bg-muted hover:text-foreground data-selected:bg-primary data-selected:text-primary-foreground data-selected:hover:bg-primary/90",
        outline:
          "border-border bg-transparent hover:bg-muted hover:text-foreground data-selected:bg-primary data-selected:text-primary-foreground data-selected:border-transparent data-selected:hover:bg-primary/90 dark:border-input",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-[min(var(--radius-md),12px)]",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ToggleProps = Omit<ToggleButtonPrimitiveProps, "className"> &
  React.RefAttributes<HTMLButtonElement> &
  VariantProps<typeof toggleVariants> & {
    className?: string | undefined;
    title?: string | undefined;
  };

function Toggle({ className, variant = "default", size = "default", ...props }: ToggleProps) {
  return (
    <ToggleButtonPrimitive
      data-slot="toggle"
      data-variant={variant}
      data-size={size}
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
