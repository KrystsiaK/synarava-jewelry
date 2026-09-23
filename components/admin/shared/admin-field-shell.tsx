"use client";

import { useId, type ReactNode } from "react";

import { AdminFieldError } from "@/components/admin/shared/admin-form-validation";
import { FieldLabel } from "@/components/admin/shared/field-label";
import { OwnershipLabel, type AdminFieldOwner } from "@/components/admin/shared/ownership-label";
import { cn } from "@/lib/ui";

export function fieldClass(error?: string) {
  return error ? "adm-field adm-field--error" : "adm-field";
}

export type AdminFieldShellProps = {
  id?: string;
  label?: ReactNode;
  owner?: AdminFieldOwner;
  help?: ReactNode;
  required?: boolean;
  error?: string;
  errorId?: string;
  /** Absolute under-control copy (e.g. AdminFieldIssue). Same band as AdminFieldError. */
  issue?: ReactNode;
  disabled?: boolean;
  className?: string;
  controlId: string;
  children: ReactNode;
  /** data-component value for the shell. */
  component?: string;
};

/** Shared label + absolute error shell used by AdminTextField / AdminSelectField. */
export function AdminFieldShell({
  id,
  label,
  owner,
  help,
  required = false,
  error,
  errorId,
  issue,
  disabled = false,
  className,
  controlId,
  children,
  component = "AdminFieldShell",
}: AdminFieldShellProps) {
  const reactId = useId();
  const messageId = errorId ?? `${reactId}-error`;

  const labelNode = label == null ? null : owner ? (
    <OwnershipLabel owner={owner} help={help}>
      {label}
      {required ? " *" : null}
    </OwnershipLabel>
  ) : (
    <FieldLabel help={help} required={required}>{label}</FieldLabel>
  );

  return (
    <div
      id={id}
      data-component={component}
      data-disabled={disabled ? "true" : "false"}
      className={cn("adm-field-unit", disabled ? "pointer-events-none opacity-55" : null, className)}
    >
      {labelNode ? <label htmlFor={controlId}>{labelNode}</label> : null}
      {children}
      {issue}
      <AdminFieldError id={messageId} message={error} />
    </div>
  );
}

export function useAdminFieldIds(id?: string, errorId?: string) {
  const reactId = useId();
  return {
    controlId: id ?? `${reactId}-field`,
    messageId: errorId ?? `${reactId}-error`,
  };
}
