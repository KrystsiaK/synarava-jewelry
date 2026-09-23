"use client";

import type { ComponentProps, ReactNode } from "react";

import {
  AdminFieldShell,
  fieldClass,
  useAdminFieldIds,
} from "@/components/admin/shared/admin-field-shell";
import type { AdminFieldOwner } from "@/components/admin/shared/ownership-label";
import { cn } from "@/lib/ui";

type SelectProps = Omit<ComponentProps<"select">, "className" | "children">;

export type AdminSelectFieldProps = SelectProps & {
  label?: ReactNode;
  owner?: AdminFieldOwner;
  help?: ReactNode;
  required?: boolean;
  error?: string;
  errorId?: string;
  /** Force error chrome without error copy (e.g. issue-linked fields). */
  invalid?: boolean;
  className?: string;
  unitId?: string;
  issue?: ReactNode;
  selectClassName?: string;
  children: ReactNode;
};

/**
 * Admin dropdown control — same shell as AdminTextField (label, owner, help, absolute error).
 */
export function AdminSelectField({
  id,
  label,
  owner,
  help,
  required = false,
  error,
  errorId,
  invalid = false,
  disabled,
  className,
  unitId,
  issue,
  selectClassName,
  children,
  "aria-invalid": ariaInvalid,
  "aria-errormessage": ariaErrorMessage,
  ...selectProps
}: AdminSelectFieldProps) {
  const { controlId, messageId } = useAdminFieldIds(id, errorId);
  const showError = Boolean(error) || invalid || ariaInvalid === true;

  return (
    <AdminFieldShell
      id={unitId}
      component="AdminSelectField"
      label={label}
      owner={owner}
      help={help}
      required={required}
      error={error}
      errorId={messageId}
      issue={issue}
      disabled={disabled}
      className={className}
      controlId={controlId}
    >
      <select
        {...selectProps}
        id={controlId}
        disabled={disabled}
        required={required || selectProps.required}
        aria-invalid={showError ? true : undefined}
        aria-errormessage={showError ? (ariaErrorMessage ?? messageId) : undefined}
        className={cn(fieldClass(showError ? error || "invalid" : undefined), selectClassName)}
      >
        {children}
      </select>
    </AdminFieldShell>
  );
}
