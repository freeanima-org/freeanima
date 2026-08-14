import type { ComponentPropsWithoutRef, Context, ReactNode } from "react";
import { LabelContext, Label as LabelPrimitive } from "react-aria-components";

import { cn } from "../../lib/utils.ts";

type LabelProps = {
  className?: string;
  htmlFor?: string;
  slot?: string;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<"label">, "className" | "htmlFor" | "children" | "slot">;

/** oxlint type-aware 对 RAC LabelContext 解析为 error type；经 unknown 收窄后使用 Provider。 */
const LabelContextSafe = LabelContext as unknown as Context<null>;

function Label({ className, htmlFor, slot, ...props }: LabelProps) {
  const label = (
    <LabelPrimitive
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-data-disabled:opacity-50",
        className,
      )}
      htmlFor={htmlFor}
      slot={slot}
      {...props}
    />
  );

  if (htmlFor && slot === undefined) {
    return <LabelContextSafe.Provider value={null}>{label}</LabelContextSafe.Provider>;
  }

  return label;
}

export { Label };
