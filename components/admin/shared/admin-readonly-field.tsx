"use client";

import { useId, type ReactNode } from "react";

import { FieldLabel } from "@/components/admin/shared/field-label";
import { OwnershipLabel, type AdminFieldOwner } from "@/components/admin/shared/ownership-label";
import { cn } from "@/lib/ui";

export type AdminReadonlyFieldProps = {
  id?: string;
  label: ReactNode;
  owner?: AdminFieldOwner;
  help?: ReactNode;
  /** Display value. Empty / null / undefined shows `emptyLabel`. */
  value: ReactNode;
  emptyLabel?: string;
  className?: string;
};

/**
 * Label + value display with no input chrome.
 * Use for Shopify-synced facts edited elsewhere, or derived UI-only numbers.
 */
export function AdminReadonlyField({
  id,
  label,
  owner,
  help,
  value,
  emptyLabel = "—",
  className,
}: AdminReadonlyFieldProps) {
  const reactId = useId();
  const valueId = id ?? `${reactId}-value`;
  const labelId = `${valueId}-label`;
  const isEmpty = value == null || value === "";

  const labelNode = owner ? (
    <OwnershipLabel owner={owner} help={help}>
      {label}
    </OwnershipLabel>
  ) : (
    <FieldLabel help={help}>{label}</FieldLabel>
  );

  return (
    <div
      data-component="AdminReadonlyField"
      data-empty={isEmpty ? "true" : "false"}
      className={cn("adm-field-unit adm-readonly", className)}
    >
      <div id={labelId} className="adm-readonly__label">
        {labelNode}
      </div>
      <p
        id={valueId}
        aria-labelledby={labelId}
        data-empty={isEmpty ? "true" : "false"}
        className="adm-readonly__value"
      >
        {isEmpty ? emptyLabel : value}
      </p>
    </div>
  );
}
