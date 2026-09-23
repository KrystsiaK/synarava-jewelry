"use client";

import type { ComponentProps, ReactNode } from "react";

import { useAdminFieldIds } from "@/components/admin/shared/admin-field-shell";
import { cn } from "@/lib/ui";

type CheckboxProps = Omit<ComponentProps<"input">, "type" | "className" | "children">;

export type AdminCheckboxControlProps = CheckboxProps & {
  label: ReactNode;
  /** Optional class on the label row (not the input). */
  className?: string;
  inputClassName?: string;
  labelClassName?: string;
};

/**
 * Styled checkbox + label row. Use alone for inline/ack rows, or inside AdminCheckboxField.
 */
export function AdminCheckboxControl({
  id,
  label,
  disabled,
  className,
  inputClassName,
  labelClassName,
  ...inputProps
}: AdminCheckboxControlProps) {
  const { controlId } = useAdminFieldIds(id);

  return (
    <label
      data-component="AdminCheckboxControl"
      data-disabled={disabled ? "true" : "false"}
      className={cn("adm-check", disabled ? "pointer-events-none opacity-55" : null, className)}
    >
      <input
        {...inputProps}
        id={controlId}
        type="checkbox"
        disabled={disabled}
        className={cn("adm-check__input", inputClassName)}
      />
      <span className={cn("adm-check__label", labelClassName)}>{label}</span>
    </label>
  );
}

export type AdminCheckboxFieldProps = CheckboxProps & {
  label: ReactNode;
  className?: string;
  inputClassName?: string;
  labelClassName?: string;
  /** Extra content under the checkbox (e.g. certificate URL). */
  children?: ReactNode;
};

/**
 * Bordered admin checkbox field — same visual band as text/select controls.
 */
export function AdminCheckboxField({
  label,
  className,
  inputClassName,
  labelClassName,
  children,
  ...inputProps
}: AdminCheckboxFieldProps) {
  return (
    <div data-component="AdminCheckboxField" className={cn("adm-check-field", className)}>
      <AdminCheckboxControl
        {...inputProps}
        label={label}
        inputClassName={inputClassName}
        labelClassName={labelClassName}
      />
      {children}
    </div>
  );
}
