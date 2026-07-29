import type { ReactNode } from "react";

import { Checkbox } from "../components/ui/checkbox.tsx";
import { Label } from "../components/ui/label.tsx";
import { cn } from "../lib/cn.ts";

/** 单字段表单组（label + control + 可选 hint） */
export function FormField({
  label,
  hint,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className={cn("space-y-2", className)}>
      <legend className="text-sm font-medium">{label}</legend>
      {children}
      {hint != null && hint !== "" ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </fieldset>
  );
}

/** 多字段分组 */
export function FormFieldset({
  legend,
  className,
  bordered = true,
  children,
}: {
  legend?: ReactNode;
  className?: string;
  bordered?: boolean;
  children: ReactNode;
}) {
  return (
    <fieldset
      className={cn("space-y-3", bordered && "bg-muted/50 border rounded-lg p-4", className)}
    >
      {legend != null && legend !== "" ? (
        <legend className="text-sm font-medium px-1">{legend}</legend>
      ) : null}
      {children}
    </fieldset>
  );
}

/** 分组内字段标签 */
export function FormFieldLabel({
  htmlFor,
  className,
  children,
}: {
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Label className={cn("text-sm", className)} htmlFor={htmlFor}>
      {children}
    </Label>
  );
}

/** 开关行：checkbox + 文案 */
export function FormToggle({
  label,
  hint,
  checked,
  disabled,
  className,
  onChange,
}: {
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  className?: string;
  onChange: (checked: boolean) => void;
}) {
  const id = `form-toggle-${String(label).replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div className={cn("flex items-start gap-3 py-1", className)}>
      <Checkbox
        id={id}
        checked={checked}
        {...(disabled !== undefined ? { disabled } : {})}
        onCheckedChange={(value) => onChange(value === true)}
      />
      <div className="grid gap-0.5">
        <Label htmlFor={id} className="font-medium cursor-pointer">
          {label}
        </Label>
        {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
      </div>
    </div>
  );
}
