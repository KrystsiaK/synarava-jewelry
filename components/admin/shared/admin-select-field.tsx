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
  warning?: string;
  /** Force error chrome without error copy (e.g. issue-linked fields). */
  invalid?: boolean;
  disabled?: boolean;
  selectClassName?: string;
  groupClassName?: string;
  children: ReactNode;
  "aria-invalid"?: true | undefined;
  "aria-errormessage"?: string | undefined;
  "aria-describedby"?: string | undefined;
};

/**
 * Select inside the shared adm-field-group chrome (same border/focus as text).
 * Use inside AdminSelectField or embed in composites.
 */
export function AdminSelectControl({
  controlId,
  error,
  warning,
  invalid = false,
  disabled,
  selectClassName,
  groupClassName,
  children,
  "aria-invalid": ariaInvalid,
  "aria-errormessage": ariaErrorMessage,
  "aria-describedby": ariaDescribedBy,
  ...selectProps
}: AdminSelectControlProps) {
  const showError = Boolean(error) || invalid || ariaInvalid === true;
  const showWarning = !showError && Boolean(warning);

  return (
    <div
      data-slot="control-group"
      data-control="select"
      className={cn(
        "adm-field-group",
        showError ? "adm-field-group--error" : showWarning ? "adm-field-group--warning" : null,
        groupClassName,
      )}
    >
      <select
        {...selectProps}
        id={controlId}
        disabled={disabled}
        aria-invalid={showError ? true : undefined}
        aria-errormessage={showError ? ariaErrorMessage : undefined}
        aria-describedby={ariaDescribedBy}
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
  warning?: string;
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
  warning,
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
  const { controlId, messageId, warningId } = useAdminFieldIds(id, errorId);

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
      warning={warning}
      warningId={warningId}
      issue={issue}
      disabled={disabled}
      className={className}
      controlId={controlId}
    >
      <AdminSelectControl
        {...selectProps}
        controlId={controlId}
        error={error}
        warning={warning}
        invalid={invalid}
        disabled={disabled}
        required={required}
        selectClassName={selectClassName}
        aria-invalid={ariaInvalid === true ? true : undefined}
        aria-errormessage={ariaErrorMessage ?? messageId}
        aria-describedby={!error && warning ? warningId : undefined}
      >
        {children}
      </AdminSelectControl>
    </AdminFieldShell>
  );
}
