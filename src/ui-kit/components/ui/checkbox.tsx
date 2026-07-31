import {
  Checkbox as CheckboxPrimitive,
  composeRenderProps,
  type CheckboxProps,
} from "react-aria-components";

import { cn, ariaRenderProps } from "../../lib/utils.ts";
import { omitUndefined } from "../../lib/omit-undefined.ts";
import { CheckIcon } from "lucide-react";

type Props = Omit<CheckboxProps, "isSelected" | "onChange" | "isDisabled"> & {
  isSelected?: boolean;
  onChange?: (isSelected: boolean) => void;
  isDisabled?: boolean;
  /** @deprecated 使用 isSelected */
  checked?: boolean | "indeterminate";
  /** @deprecated 使用 onChange */
  onCheckedChange?: (checked: boolean | "indeterminate") => void;
  /** @deprecated 使用 isDisabled */
  disabled?: boolean;
};

function Checkbox({
  className,
  children,
  isSelected,
  onChange,
  checked,
  onCheckedChange,
  isDisabled,
  disabled,
  isIndeterminate: isIndeterminateProp,
  ...props
}: Props) {
  const resolvedSelected = isSelected ?? (checked === "indeterminate" ? undefined : checked);
  const resolvedOnChange =
    onChange ?? (onCheckedChange ? (selected: boolean) => onCheckedChange(selected) : undefined);
  const isIndeterminate = checked === "indeterminate" || isIndeterminateProp;

  return (
    <CheckboxPrimitive
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input transition-colors outline-none group-has-disabled/field:opacity-50 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary data-focus-visible:border-ring data-focus-visible:ring-3 data-focus-visible:ring-ring/50 data-invalid:border-destructive data-invalid:ring-3 data-invalid:ring-destructive/20 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 dark:data-invalid:border-destructive/50 dark:data-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary data-selected:border-primary data-selected:bg-primary data-selected:text-primary-foreground data-invalid:data-selected:border-primary dark:data-selected:bg-primary",
        className,
      )}
      {...omitUndefined({
        isSelected: resolvedSelected,
        isIndeterminate,
        onChange: resolvedOnChange,
        isDisabled: isDisabled ?? disabled,
      })}
      {...props}
    >
      {composeRenderProps(
        children,
        ariaRenderProps((node, { isSelected: selected, isIndeterminate: indeterminate }) => (
          <>
            <span
              data-slot="checkbox-indicator"
              className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
            >
              {(selected || indeterminate) && <CheckIcon />}
            </span>
            {node}
          </>
        )),
      )}
    </CheckboxPrimitive>
  );
}

export { Checkbox };
