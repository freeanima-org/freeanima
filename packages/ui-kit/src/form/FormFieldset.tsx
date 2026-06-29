import type { ReactNode } from "react";

function cn(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(" ");
}

/** daisyUI fieldset：单字段（legend + control + 可选 hint） */
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
    <fieldset className={cn("fieldset", className)}>
      <legend className="fieldset-legend">{label}</legend>
      {children}
      {hint != null && hint !== "" ? <p className="label">{hint}</p> : null}
    </fieldset>
  );
}

/** daisyUI fieldset：多字段分组 */
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
      className={cn(
        "fieldset",
        bordered && "bg-base-200 border-base-300 rounded-box border p-4",
        className,
      )}
    >
      {legend != null && legend !== "" ? (
        <legend className="fieldset-legend">{legend}</legend>
      ) : null}
      {children}
    </fieldset>
  );
}

/** 分组内字段标签（配合 FormFieldset 多字段布局） */
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
    <label className={cn("label", className)} htmlFor={htmlFor}>
      {children}
    </label>
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
  return (
    <fieldset className={cn("fieldset", className)}>
      <label className="label cursor-pointer justify-start gap-3 py-1">
        <input
          type="checkbox"
          className="checkbox checkbox-sm"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>
          <span className="font-medium">{label}</span>
          {hint ? <span className="label block py-0 text-base-content/50">{hint}</span> : null}
        </span>
      </label>
    </fieldset>
  );
}
