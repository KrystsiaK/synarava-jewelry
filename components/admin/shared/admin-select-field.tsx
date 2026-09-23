"use client";

import type { ComponentProps, ReactNode } from "react";

import {
  AdminFieldShell,
  useAdminFieldIds,
} from "@/components/admin/shared/admin-field-shell";
import type { AdminFieldOwner } from "@/components/admin/shared/ownership-label";
import { cn } from "@/lib/ui";

type SelectProps = Omit<ComponentProps<"select">, "className" | "children">;

export type AdminSelectControlProps = SelectProps & {
  controlId?: string;
  error?: string;
  /** Force error chrome without error copy (e.g. issue-linked fields). */
  invalid?: boolean;
  disabled?: boolean;
  selectClassName?: string;
  groupClassName?: string;
  children: ReactNode;
  "aria-invalid"?: true | undefined;
  "aria-errormessage"?: string | undefined;
};

/**
 * Select inside the shared adm-field-group chrome (same border/focus as text).
 * Use inside AdminSelectField or embed in composites.
 */
export function AdminSelectControl({
  controlId,
  error,
  invalid = false,
  disabled,
  selectClassName,
  groupClassName,
  children,
  "aria-invalid": ariaInvalid,
  "aria-errormessage": ariaErrorMessage,
  ...selectProps
}: AdminSelectControlProps) {
  const showError = Boolean(error) || invalid || ariaInvalid === true;

  return (
    <div
      data-slot="control-group"
      data-control="select"
      className={cn(
        "adm-field-group",
        showError ? "adm-field-group--error" : null,
        groupClassName,
      )}
    >
      <select
        {...selectProps}
        id={controlId}
        disabled={disabled}
        aria-invalid={showError ? true : undefined}
        aria-errormessage={showError ? ariaErrorMessage : undefined}
        className={cn("adm-field adm-field--in-group adm-field--select", selectClassName)}
      >
        {children}
      </select>
    </div>
  );
}

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
 * Admin dropdown — same shell + field-group chrome as AdminTextField.
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
      <AdminSelectControl
        {...selectProps}
        controlId={controlId}
        error={error}
        invalid={invalid}
        disabled={disabled}
        required={required}
        selectClassName={selectClassName}
        aria-invalid={ariaInvalid === true ? true : undefined}
        aria-errormessage={ariaErrorMessage ?? messageId}
      >
        {children}
      </AdminSelectControl>
    </AdminFieldShell>
  );
}
